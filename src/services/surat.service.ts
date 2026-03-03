import { supabase } from "@/lib/supabase";
import ExcelJS from "exceljs";

export interface SuratRegistrasi {
  id: string;
  no_surat: string | null;
  judul_surat: string;
  file_path: string | null;
  status: string;
  current_step: number;
  created_at: string;
  updated_at: string;
  entity_id?: string;
  office_id?: string;
  project_id?: string;
  dept_id?: string;
  letter_type_id?: string;
  penggunaan_id?: string;
  surat_signatures?: Array<{
    id: string;
    role_name: string;
    step_order: number;
    is_signed: boolean;
    signed_at: string | null;
    profiles?: {
      full_name: string;
    };
  }>;
}

export const suratService = {
  cleanUuid(id: any) {
    if (!id || id === "" || id === "pusat" || id === "undefined" || id === "null")
      return null;
    return id;
  },

  getRelativePath(publicUrl: string) {
    const clean = publicUrl.split("?")[0];
    return clean.split("dokumen_surat/").pop() || "";
  },

  resolveStampPositions(worksheet: ExcelJS.Worksheet, usageDetail: any, role: string) {
    const roleClean = role.trim();
    const results: any[] = [];
    const ROLE_MAPPING: Record<string, string> = {
      "BM": "Branch Manager",
      "Pimp. Dept": "Pimpinan Departemen",
      "Mkt": "Marketing",
      "Spv. Mkt": "Supervisor Marketing",
      "Mgr. Perencanaan": "Manager Perencanaan",
      "Dir. Bidang": "Direktur Bidang"
    };

    const formalRole = ROLE_MAPPING[roleClean] || roleClean;

    if (usageDetail.ttd_config && Array.isArray(usageDetail.ttd_config)) {
      const dynamicMatch = usageDetail.ttd_config.find((cfg: any) => cfg.roleName.trim() === roleClean);
      if (dynamicMatch) return [{ ttd: dynamicMatch.ttd, nama: dynamicMatch.nama, jabatan: dynamicMatch.jabatan, labelJabatan: dynamicMatch.labelJabatan || formalRole }];
    }

    const isRoleMatch = (dbValue: string) => dbValue?.split(/[,\/]+/).map(r => r.trim()).includes(roleClean);
    const isEmpty = (cell: string) => !worksheet.getCell(cell).value || worksheet.getCell(cell).value?.toString().trim() === "";

    if (isRoleMatch(usageDetail.membuat)) {
      const col = isEmpty("G38") ? "G" : (isEmpty("H38") ? "H" : "");
      if (col) results.push({ ttd: `${col}35`, nama: `${col}38`, jabatan: `${col}39`, labelJabatan: formalRole });
    }
    if (isRoleMatch(usageDetail.memeriksa)) {
      const col = isEmpty("K38") ? "K" : (isEmpty("N38") ? "N" : "");
      if (col) results.push({ ttd: `${col}35`, nama: `${col}38`, jabatan: `${col}39`, labelJabatan: formalRole });
    }
    if (isRoleMatch(usageDetail.menyetujui)) {
      const col = isEmpty("K44") ? "K" : (isEmpty("N44") ? "N" : "");
      if (col) results.push({ ttd: `${col}41`, nama: `${col}44`, jabatan: `${col}45`, labelJabatan: formalRole });
    }
    return results.length > 0 ? results : null;
  },

  async generateNoSurat(payload: any): Promise<{ fullNumber: string; noUrut: number }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const officeIdClean = this.cleanUuid(payload.office_id);
      const projectIdClean = this.cleanUuid(payload.project_id);

      const [officeRes, deptRes] = await Promise.all([
        supabase.from("master_offices").select("code, kedudukan, parent_id").eq("id", officeIdClean).single(),
        supabase.from("master_departments").select("code, dept_index").eq("id", payload.dept_id).single()
      ]);

      const office = officeRes.data;
      const isPusat = office?.kedudukan === 'Pusat';

      const { data: nextNumber, error: rpcError } = await supabase.rpc('generate_new_letter_number', {
        p_entity_id: payload.entity_id,
        p_type_id: payload.letter_type_id,
        p_office_id: officeIdClean,
        p_project_id: projectIdClean,
        p_user_id: user?.id
      });

      if (rpcError) throw new Error("Gagal menerbitkan nomor urut.");

      const [entityRes, projectRes, mappingRes] = await Promise.all([
        supabase.from("master_entities").select("code").eq("id", payload.entity_id).single(),
        projectIdClean ? supabase.from("master_projects").select("code").eq("id", projectIdClean).single() : Promise.resolve({ data: null }),
        supabase.from("master_dept_letter_types")
          .select("sort_index")
          .eq("dept_id", payload.dept_id)
          .eq("letter_type_id", payload.letter_type_id)
          .maybeSingle()
      ]);

      const noUrutStr = String(nextNumber).padStart(3, "0");
      const entityCode = entityRes.data?.code || "??";
      const deptCode = deptRes.data?.code || ""; 
      const dIndex = deptRes.data?.dept_index || "0"; 
      const tIndex = mappingRes.data?.sort_index || "0"; 
      
      const romawiBulan = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
      const bulan = romawiBulan[new Date().getMonth()];
      const tahun = new Date().getFullYear();

      let middleCode = "";
      if (isPusat) {
        middleCode = `${deptCode}.${tIndex}`;
      } else {
        const projCode = projectRes.data?.code || "??";
        if (office?.kedudukan === 'KC') {
          middleCode = `${office.code}-${projCode}.${dIndex}.${tIndex}`;
        } else {
          const { data: parent } = await supabase.from("master_offices").select("code").eq("id", office?.parent_id).single();
          const parentCode = parent?.code || "??";
          middleCode = `${parentCode}.${office?.code}-${projCode}.${dIndex}.${tIndex}`;
        }
      }

      return {
        fullNumber: `${noUrutStr}/${entityCode}/${middleCode}/${bulan}/${tahun}`,
        noUrut: nextNumber
      };
    } catch (error: any) {
      console.error("Error generating number:", error);
      throw error;
    }
  },

  async createRegistrasi(payload: any, signers: any[], file: File | null, lampiranFile?: File | null) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const noUrut = parseInt(payload.no_surat.split('/')[0]);
      const currentYear = new Date().getFullYear();

      const cleanPayload = {
        ...payload,
        entity_id: this.cleanUuid(payload.entity_id),
        office_id: this.cleanUuid(payload.office_id),
        project_id: this.cleanUuid(payload.project_id),
        dept_id: this.cleanUuid(payload.dept_id),
        letter_type_id: this.cleanUuid(payload.letter_type_id),
        penggunaan_id: this.cleanUuid(payload.penggunaan_id),
        created_by: user?.id,
      };

      if (file) cleanPayload.file_path = await this.uploadFile(file);
      if (lampiranFile) cleanPayload.lampiran_path = await this.uploadFile(lampiranFile);

      const { data: surat, error: suratError } = await supabase
        .from("surat_registrasi")
        .insert(cleanPayload)
        .select()
        .single();
      
      if (suratError) throw suratError;

      await supabase.from('surat_reservations')
        .update({ status: 'USED' })
        .match({ 
          no_urut: noUrut,
          entity_id: cleanPayload.entity_id,
          year: currentYear,
          reserved_by: user?.id,
          status: 'PENDING' 
        });

      const signerPayload = signers.filter(s => s.user_id).map(s => ({
        surat_id: surat.id,
        user_id: s.user_id,
        role_name: s.role_name,
        step_order: s.step_order,
        is_signed: false
      }));

      if (signerPayload.length > 0) {
        await supabase.from("surat_signatures").insert(signerPayload);
      }

      return surat;
    } catch (error: any) {
      console.error("Error in createRegistrasi:", error);
      throw new Error(error.message);
    }
  },

  async cancelRegistration(noSurat: string) {
    const { data: { user } } = await supabase.auth.getUser();
    const noUrut = parseInt(noSurat.split('/')[0]);
    const currentYear = new Date().getFullYear();

    const { error } = await supabase
      .from("surat_reservations")
      .update({ status: "CANCELLED" })
      .match({ 
        no_urut: noUrut, 
        reserved_by: user?.id,
        year: currentYear,
        status: "PENDING" 
      });

    if (error) throw error;
    return true;
  },

  async stampApprovalExcel(suratId: string, currentFilePath: string, userName: string, roleName: string, usageId: string): Promise<string> {
    const { data: usageDetail } = await supabase.from("master_penggunaan_detail").select("*").eq("id", usageId).single();
    if (!usageDetail) return currentFilePath;

    const relativePath = this.getRelativePath(currentFilePath);
    const { data: fileData, error: dlError } = await supabase.storage.from("dokumen_surat").download(relativePath);
    if (dlError || !fileData) throw new Error("Gagal download file.");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await fileData.arrayBuffer());
    const worksheet = workbook.worksheets[0];
    const positions = this.resolveStampPositions(worksheet, usageDetail, roleName);

    if (positions) {
      const now = new Date();
      positions.forEach((pos: any) => {
        const ttdCell = worksheet.getCell(pos.ttd);
        ttdCell.value = `Disetujui by sistem\n✅\n${now.toLocaleDateString("id-ID")}\n${now.toLocaleTimeString("id-ID")} WIB`;
        ttdCell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(parseInt(pos.ttd.match(/\d+/)?.[0] || '35')).height = 65;
        
        worksheet.getCell(pos.nama).value = userName.toUpperCase();
        worksheet.getCell(pos.jabatan).value = pos.labelJabatan;
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const newPath = relativePath.replace(".xlsx", `_v${Date.now()}.xlsx`);
    await supabase.storage.from("dokumen_surat").upload(newPath, buffer, { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", upsert: true });
    
    const { data: { publicUrl } } = supabase.storage.from("dokumen_surat").getPublicUrl(newPath);
    await supabase.from("surat_registrasi").update({ file_path: publicUrl }).eq("id", suratId);
    return publicUrl;
  },

  async approveSurat(signatureId: string, suratId: string, currentStep: number, userName: string, note: string = "") {
    const { data: sigInfo } = await supabase
      .from("surat_signatures")
      .select(`role_name, surat_registrasi (file_path, penggunaan_id)`)
      .eq("id", signatureId)
      .single();

    const suratData = Array.isArray(sigInfo?.surat_registrasi) 
      ? sigInfo?.surat_registrasi[0] 
      : sigInfo?.surat_registrasi;

    let finalUrl = suratData?.file_path;

    if (suratData?.file_path?.toLowerCase().includes(".xlsx") && suratData?.penggunaan_id) {
      finalUrl = await this.stampApprovalExcel(
        suratId, 
        suratData.file_path, 
        userName, 
        sigInfo!.role_name, 
        suratData.penggunaan_id
      );
    }

    const { error: updateSigError } = await supabase
      .from("surat_signatures")
      .update({ 
        is_signed: true,
        signed_at: new Date().toISOString(),
        file_path_snap: finalUrl,
        catatan: note,
        status: 'SUCCESS'
      })
      .eq("id", signatureId);

    if (updateSigError) throw updateSigError;

    const { data, error } = await supabase.rpc('handle_approve_surat', { 
      p_sig_id: signatureId, 
      p_surat_id: suratId, 
      p_current_step: currentStep, 
      p_signer_name: userName, 
      p_note: note 
    });

    if (error) throw error;
    return data;
  },

  // FUNGSI UNTUK REJECT SURAT (MEMPERBAIKI ERROR TS)
  async rejectSurat(signatureId: string, suratId: string, note: string) {
    // Update status di signature
    const { error: sigError } = await supabase
      .from("surat_signatures")
      .update({
        is_signed: true, // Dianggap selesai memproses (tapi reject)
        signed_at: new Date().toISOString(),
        catatan: note,
        status: 'REJECTED'
      })
      .eq("id", signatureId);

    if (sigError) throw sigError;

    // Update status di tabel utama surat_registrasi
    const { error: suratError } = await supabase
      .from("surat_registrasi")
      .update({
        status: 'REJECTED'
      })
      .eq("id", suratId);

    if (suratError) throw suratError;
    return true;
  },

  async getMyInbox(userId: string) {
    const { data, error } = await supabase.from("surat_signatures").select(`id, role_name, step_order, is_signed, surat_id, surat_registrasi!inner (*)`).eq("user_id", userId).eq("is_signed", false);
    if (error) return [];
    return data.map((sig: any) => {
      const surat = Array.isArray(sig.surat_registrasi) ? sig.surat_registrasi[0] : sig.surat_registrasi;
      if (!surat || Number(sig.step_order) !== Number(surat.current_step)) return null;
      return { ...sig, surat_registrasi: { ...surat, file_path: `${surat.file_path}?cb=${Date.now()}` } };
    }).filter(Boolean);
  },

  async uploadFile(file: File) {
    const filePath = `dokumen/${Date.now()}_${file.name}`;
    await supabase.storage.from("dokumen_surat").upload(filePath, file);
    return supabase.storage.from("dokumen_surat").getPublicUrl(filePath).data.publicUrl;
  },

  async getAllSurat(userId?: string): Promise<SuratRegistrasi[]> {
    let query = supabase.from("surat_registrasi").select(`*, surat_signatures (*, profiles:user_id (full_name))`).order("created_at", { ascending: false });
    if (userId) query = query.eq('created_by', userId);
    const { data } = await query;
    return (data || []).map((s: any) => ({ ...s, surat_signatures: s.surat_signatures?.sort((a: any, b: any) => a.step_order - b.step_order) || [] })) as SuratRegistrasi[];
  },

  async getMasterData() {
    const res = await Promise.all([
      supabase.from("master_entities").select("*"),
      supabase.from("master_offices").select("*"),
      supabase.from("master_departments").select("*"),
      supabase.from("master_letter_types").select("*"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
      supabase.from("master_projects").select("*").order("name"),
      supabase.from("master_penggunaan_detail").select("*").order("penggunaan")
    ]);
    return { entities: res[0].data || [], offices: res[1].data || [], depts: res[2].data || [], types: res[3].data || [], users: res[4].data || [], projects: res[5].data || [], penggunaan: res[6].data || [] };
  },

  async downloadFilledTemplate(payload: any, templateLink: string) {
    const [officeRes, projectRes, deptRes] = await Promise.all([
      payload.office_id ? supabase.from("master_offices").select("name").eq("id", payload.office_id).maybeSingle() : Promise.resolve({ data: null }),
      payload.project_id ? supabase.from("master_projects").select("name").eq("id", payload.project_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("master_departments").select("name").eq("id", payload.dept_id).maybeSingle()
    ]);

    const response = await fetch(templateLink);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());
    const worksheet = workbook.worksheets[0];

    worksheet.getCell(payload.is_aset ? "B4" : "E4").value = "V";
    worksheet.getCell("D5").value = `: ${payload.no_surat}`;
    if (payload.office_id && officeRes?.data?.name !== 'Kantor Pusat') {
      worksheet.getCell("L4").value = `: KC. ${officeRes?.data?.name || ""}`;
      worksheet.getCell("L5").value = `: ${projectRes?.data?.name || ""}`;
    } else {
      worksheet.getCell("L4").value = `: ${deptRes?.data?.name || ""}`;
      worksheet.getCell("L5").value = ": -";
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const a = document.createElement("a");
    a.href = window.URL.createObjectURL(new Blob([buffer]));
    a.download = `Form_${payload.no_surat?.replace(/\//g, '_')}.xlsx`;
    a.click();
    return true;
  },

  getPreviewUrl(publicUrl: string) {
    // Menggunakan officeapps.live.com (Microsoft Office Viewer) seringkali lebih stabil untuk .xlsx
    return publicUrl ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicUrl)}` : "";
  }
};