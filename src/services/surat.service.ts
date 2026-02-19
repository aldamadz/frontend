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

  resolveStampPositions(
    worksheet: ExcelJS.Worksheet,
    usageDetail: any,
    role: string
  ) {
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

    // Helper untuk mengecek apakah role user ada di dalam kolom database (split , atau /)
    const isRoleMatch = (dbValue: string) => {
      if (!dbValue) return false;
      return dbValue.split(/[,\/]+/).map(r => r.trim()).includes(roleClean);
    };

    const isEmpty = (cell: string) => {
      const val = worksheet.getCell(cell).value;
      return !val || val.toString().trim() === "";
    };

    /**
     * LOGIKA 1: MEMBUAT (Baris 35-39, Kolom G atau H)
     * Contoh data DB: 'Pimp. Dept / BM'
     */
    if (isRoleMatch(usageDetail.membuat)) {
      let col = "";
      if (isEmpty("G38")) {
        col = "G";
      } else if (isEmpty("H38")) {
        col = "H";
      }

      if (col) {
        results.push({ 
          ttd: `${col}35`, 
          nama: `${col}38`, 
          jabatan: `${col}39`,
          labelJabatan: formalRole 
        });
      }
    }

    /**
     * LOGIKA 2: MEMERIKSA (Baris 35-39, Kolom K atau N)
     * Contoh data DB: 'BM, Mgr Marketing'
     */
    if (isRoleMatch(usageDetail.memeriksa)) {
      let col = "";
      if (isEmpty("K38")) {
        col = "K";
      } else if (isEmpty("N38")) {
        col = "N";
      }

      if (col) {
        results.push({ 
          ttd: `${col}35`, 
          nama: `${col}38`, 
          jabatan: `${col}39`,
          labelJabatan: formalRole 
        });
      }
    }

    /**
     * LOGIKA 3: MENYETUJUI (Baris 41-45, Kolom K atau N)
     */
    if (isRoleMatch(usageDetail.menyetujui)) {
      let col = "";
      if (isEmpty("K44")) {
        col = "K";
      } else if (isEmpty("N44")) {
        col = "N";
      }

      if (col) {
        results.push({ 
          ttd: `${col}41`, 
          nama: `${col}44`, 
          jabatan: `${col}45`,
          labelJabatan: formalRole 
        });
      }
    }

    return results.length > 0 ? results : null;
  },

/* =========================================================
      GENERATE NOMOR SURAT
  ========================================================= */

async generateNoSurat(payload: any): Promise<string> {
  try {
    const date = new Date();
    const romawiBulan = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
    const bulan = romawiBulan[date.getMonth()];
    const tahun = date.getFullYear();

    // 1. Sanitasi office_id
    const officeIdClean = payload.office_id === "pusat" ? null : payload.office_id;

    // 2. AMBIL NOMOR URUT ATOMIC (Berdasarkan Entity, Type, dan TAHUN)
const { data: nextNumber, error: rpcError } = await supabase.rpc('get_smart_sequence', {
    p_entity_id: payload.entity_id,
    p_type_id: payload.letter_type_id,
    p_year: tahun
  });

    if (rpcError) throw new Error(`Gagal booking nomor: ${rpcError.message}`);

    // 3. Ambil data Master
    const [entityRes, officeRes, deptRes, typeRes, projectRes] = await Promise.all([
      supabase.from("master_entities").select("code").eq("id", payload.entity_id).single(),
      officeIdClean 
        ? supabase.from("master_offices").select("code").eq("id", officeIdClean).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("master_departments").select("name, code, dept_index").eq("id", payload.dept_id).single(),
      supabase.from("master_letter_types").select("code").eq("id", payload.letter_type_id).single(),
      payload.project_id 
        ? supabase.from("master_projects").select("code").eq("id", payload.project_id).single() 
        : Promise.resolve({ data: null })
    ]);

    const deptName = deptRes.data?.name || "";
    const deptCode = (deptRes.data?.code || "DEPT").trim();
    const typeCode = typeRes.data?.code || "";
    const dIndex = deptRes.data?.dept_index || "0";
    const entityCode = entityRes.data?.code || "UAI";
    
    // 4. Logika Cabang
    const isCabang = !!officeIdClean;

    // 5. Mapping Indeks Jenis Surat
    const getDynamicTypeIndex = (dept: string, type: string, cabang: boolean) => {
      const mapPusat: any = {
        "HRD & GA": ["MH","PB","BAST","SKet","SK","SKA","SKMPD","SP","SPHK","SE","SNY","Um","PKK","TGS","ST","SB"],
        "Keuangan & Akuntansi": ["MH","PB","BAST","PTG"],
        "Legal Lahan": ["MH","PB"],
        "Legal Proyek": ["MH","PB"],
        "Marketing": ["MH","PB","BAST","SPW","PSJB","PPJB","ST","SB","SE"],
        "Pengadaan": ["MH","PB","BAST","SPW","SPK","BAPP"],
        "Perencanaan": ["MH","PB"],
        "Pengembangan Bisnis": ["MH","PB","SPW","SPT","SPP"],
        "Pengembangan Sistem": ["MH","PB","BAPD","REK"]
      };

      const mapCabang: any = {
        "Umum & Keuangan (Cabang)": ["MH","PB","BAPD","BAST","PTG","SKet","SK","SKMPD","SKA","SP","SPHK","SE","SNY","Um","PKK","TGS","ST"],
        "Teknik (Cabang)": ["MH","PB","BAPD","BAST","SPW","SPK","BAPP"],
        "Marketing (Cabang)": ["MH","PB","BAPD","BAST","SPW","PSJB","PPJB","ST","SB","SE","PKS"]
      };

      const currentMap = cabang ? mapCabang : mapPusat;
      const list = currentMap[dept] || [];
      const idx = list.indexOf(type);
      return idx !== -1 ? idx + 1 : 1;
    };

    const tIndex = getDynamicTypeIndex(deptName, typeCode, isCabang);

    // 6. Susun format akhir
    const noUrutStr = String(nextNumber).padStart(3, "0");
    let middleCode = "";

    if (!isCabang) {
      middleCode = `${deptCode}.${tIndex}`;
    } else {
      const officeCode = (officeRes.data?.code || "OFF").trim();
      const projectCode = (projectRes.data?.code || "PROJ").trim();
      middleCode = `${officeCode}-${projectCode}.${dIndex}.${tIndex}`;
    }

    return `${noUrutStr}/${entityCode}/${middleCode}/${bulan}/${tahun}`;

  } catch (error: any) {
    console.error("Gagal generate nomor surat:", error);
    throw error;
  }
},

/* =========================================================
      CREATE REGISTRASI
  ========================================================= */

async createRegistrasi(payload: any, signers: any[], file: File | null) {
  try {
    const cleanPayload = {
      ...payload,
      entity_id: this.cleanUuid(payload.entity_id),
      office_id: this.cleanUuid(payload.office_id),
      project_id: this.cleanUuid(payload.project_id),
      dept_id: this.cleanUuid(payload.dept_id),
      letter_type_id: this.cleanUuid(payload.letter_type_id),
      penggunaan_id: this.cleanUuid(payload.penggunaan_id)
    };

    // 1. Validasi Cabang/Proyek
    if (cleanPayload.office_id && !cleanPayload.project_id) {
      throw new Error("Untuk pengajuan Cabang/KCP, Proyek wajib dipilih.");
    }

    /**
     * 2. GENERATE / VERIFIKASI NOMOR
     * Jika form sudah punya no_surat (hasil booking), gunakan itu.
     * Jika belum (misal bypass booking), generate nomor baru via smart sequence.
     */
    if (!cleanPayload.no_surat) {
      cleanPayload.no_surat = await this.generateNoSurat(cleanPayload);
    }

    // 3. Upload File jika ada
    if (file) {
      const fileUrl = await this.uploadFile(file);
      cleanPayload.file_path = fileUrl;
    }

    // 4. Insert ke tabel Utama (surat_registrasi)
    const { data: surat, error: suratError } = await supabase
      .from("surat_registrasi")
      .insert(cleanPayload)
      .select()
      .single();

    if (suratError) throw suratError;

    // 5. UPDATE STATUS RESERVASI MENJADI 'USED'
    // Mengunci nomor di tabel reservations agar tidak bisa di-recycle lagi
    const noUrut = parseInt(cleanPayload.no_surat.split('/')[0]);
    const currentYear = new Date().getFullYear();

    const { error: resError } = await supabase
      .from('surat_reservations')
      .update({ status: 'USED' })
      .match({ 
        entity_id: cleanPayload.entity_id, 
        type_id: cleanPayload.letter_type_id, 
        year: currentYear,
        no_urut: noUrut 
      });

    if (resError) {
      console.warn("Gagal memperbarui status reservasi, namun data registrasi berhasil disimpan.", resError);
    }

    // 6. Insert ke tabel Signatures (Workflow)
    const signerPayload = signers
      .filter(s => s.user_id)
      .map(s => ({
        surat_id: surat.id,
        user_id: s.user_id,
        role_name: s.role_name,
        step_order: s.step_order,
        is_signed: false
      }));

    if (signerPayload.length > 0) {
      const { error: signError } = await supabase
        .from("surat_signatures")
        .insert(signerPayload);
      
      if (signError) throw signError;
    }

    return surat;

  } catch (error: any) {
    console.error("Error in createRegistrasi:", error);
    throw new Error(error.message || "Gagal memproses registrasi dokumen.");
  }
},

  async stampApprovalExcel(
    suratId: string,
    currentFilePath: string,
    userName: string,
    roleName: string,
    usageId: string
  ): Promise<string> {
    // 1. Ambil detail penggunaan (siapa yang membuat, memeriksa, menyetujui)
    const { data: usageDetail } = await supabase
      .from("master_penggunaan_detail")
      .select("membuat, memeriksa, menyetujui")
      .eq("id", usageId)
      .single();

    if (!usageDetail) return currentFilePath;

    // 2. Bersihkan path file (ambil path relatif untuk storage)
    const relativePath = this.getRelativePath(currentFilePath);
    console.log("🔍 Memulai proses stamp untuk file:", relativePath);

    // 3. Download file dengan logika Retry (3x percobaan)
    let fileData: Blob | null = null;
    let downloadError: any = null;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await supabase.storage
        .from("dokumen_surat")
        .download(relativePath);

      if (error) {
        downloadError = error;
        console.warn(`⚠️ Percobaan download ke-${attempt} gagal:`, error.message);
        if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1000));
        continue;
      }

      fileData = data;
      downloadError = null;
      console.log(`✅ File berhasil diunduh pada percobaan ke-${attempt}`);
      break;
    }

    if (downloadError || !fileData) {
      throw new Error(`Gagal download file: ${downloadError?.message || 'Unknown error'}`);
    }

    // 4. Load file ke ExcelJS
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await fileData.arrayBuffer());
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return currentFilePath;

    // 5. Cari SEMUA posisi yang harus di-stamp (Array)
    const positions = this.resolveStampPositions(
      worksheet,
      usageDetail,
      roleName.trim()
    );

    // Jika role tidak terdaftar di master_penggunaan_detail untuk dokumen ini, lewati
    if (!positions || positions.length === 0) {
      console.log("ℹ️ Role tidak memiliki posisi stamp pada dokumen ini.");
      return currentFilePath;
    }

    // 6. Proses Iterasi Stamping (Bisa lebih dari 1 jika diperlukan)
    const now = new Date();
    const dateStr = now.toLocaleDateString("id-ID");
    const timeStr = now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    positions.forEach((pos: any) => {
      console.log(`🖋️ Menempelkan stamp pada cell: ${pos.ttd}`);

      // Set TTD Digital
      const ttdCell = worksheet.getCell(pos.ttd);
      ttdCell.value = `Disetujui by sistem\n✅\n${dateStr}\n${timeStr} WIB`;
      ttdCell.alignment = {
        wrapText: true,
        vertical: 'middle',
        horizontal: 'center'
      };
      
      // Atur tinggi baris (Target row dari cell TTD)
      const rowNum = parseInt(pos.ttd.match(/\d+/)?.[0] || '35');
      const ttdRow = worksheet.getRow(rowNum);
      if (ttdRow.height === undefined || ttdRow.height < 60) {
        ttdRow.height = 60; 
      }

      // Set Nama User (Upper Case)
      const namaCell = worksheet.getCell(pos.nama);
      namaCell.value = userName.toUpperCase();
      namaCell.alignment = {
        vertical: 'middle',
        horizontal: 'center'
      };

      // Set Jabatan (Hasil konversi formal, misal: BM -> Branch Manager)
      const jabatanCell = worksheet.getCell(pos.jabatan);
      jabatanCell.value = pos.labelJabatan; 
      jabatanCell.alignment = {
        vertical: 'middle',
        horizontal: 'center'
      };
    });

    // 7. Generate Buffer hasil revisi
    const buffer = await workbook.xlsx.writeBuffer();

    // 8. Logika Versioning File (Menghindari Cache & Menjaga History)
    const pathParts = relativePath.split('/');
    const originalFileName = pathParts[pathParts.length - 1];
    const fileNameNoExt = originalFileName.replace('.xlsx', '');
    const newFileName = `${fileNameNoExt}_v${Date.now()}.xlsx`;
    
    // Gabungkan kembali pathnya
    const newRelativePath = pathParts.length > 1 
      ? `${pathParts.slice(0, -1).join('/')}/${newFileName}`
      : newFileName;

    console.log("📤 Mengunggah versi terbaru ke:", newRelativePath);

    // 9. Upload ke Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("dokumen_surat")
      .upload(newRelativePath, buffer, {
        cacheControl: "0",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true
      });

    if (uploadError) {
      console.error("❌ Gagal upload file baru:", uploadError);
      throw uploadError;
    }

    // 10. Dapatkan Public URL baru
    const { data: { publicUrl } } = supabase.storage
      .from("dokumen_surat")
      .getPublicUrl(newRelativePath);

    // 11. Update database surat_registrasi dengan path baru
    const { error: updateError } = await supabase
      .from("surat_registrasi")
      .update({ 
          file_path: publicUrl,
          updated_at: new Date().toISOString() 
      })
      .eq("id", suratId);

    if (updateError) {
      console.error("❌ Gagal update database:", updateError);
      throw updateError;
    }

    console.log("✅ Proses stamp selesai. URL baru:", publicUrl);
    return publicUrl;
  },

  /* =========================================================
     APPROVE SURAT
  ========================================================= */

async approveSurat(
    signatureId: string,
    suratId: string,
    currentStep: number,
    userName: string,
    note: string = "" // Tambahkan parameter ke-5
  ): Promise<{ success: boolean; isDone: boolean }> {

    /* --- 1. VALIDASI LOCK STEP --- */
    const { data: suratFresh, error: suratErr } = await supabase
      .from("surat_registrasi")
      .select("current_step")
      .eq("id", suratId)
      .single();

    if (suratErr || !suratFresh) throw new Error("Dokumen tidak ditemukan.");
    if (suratFresh.current_step !== currentStep) throw new Error("Dokumen sudah diproses. Silakan refresh.");

    /* --- 2. AMBIL DATA UNTUK STAMPING --- */
    const { data: sigInfo } = await supabase
      .from("surat_signatures")
      .select(`role_name, surat_registrasi (file_path, penggunaan_id)`)
      .eq("id", signatureId)
      .single();

    const suratData = Array.isArray(sigInfo?.surat_registrasi) ? sigInfo?.surat_registrasi[0] : sigInfo?.surat_registrasi;

    /* --- 3. PROSES STAMPING EXCEL --- */
    if (suratData?.file_path?.toLowerCase().includes(".xlsx") && suratData?.penggunaan_id) {
      await this.stampApprovalExcel(
        suratId,
        suratData.file_path,
        userName,
        sigInfo!.role_name,
        suratData.penggunaan_id
      );
    }

    /* --- 4. EKSEKUSI DATABASE VIA RPC --- */
    const { data, error } = await supabase.rpc('handle_approve_surat', {
      p_sig_id: signatureId,
      p_surat_id: suratId,
      p_current_step: currentStep,
      p_signer_name: userName,
      p_note: note // Kirim catatan ke database
    });

    if (error) throw error;
    return data;
  },

async rejectSurat(signatureId: string, suratId: string, note: string) {
    const { data, error } = await supabase.rpc('handle_reject_surat', {
      p_sig_id: signatureId,
      p_surat_id: suratId,
      p_note: note
    });

    if (error) {
      console.error("RPC Reject Error:", error);
      throw error;
    }
    return data;
  },

  /* =========================================================
     INBOX
  ========================================================= */

async getMyInbox(userId: string) {
    const { data, error } = await supabase
      .from("surat_signatures")
      .select(`
        id,
        role_name,
        step_order,
        is_signed,
        surat_id,
        surat_registrasi!inner (
          id, no_surat, judul_surat, file_path, current_step, status, created_at, penggunaan_id
        )
      `)
      .eq("user_id", userId)
      .eq("is_signed", false);

    if (error) throw error;

    return (data || [])
      .map((sig: any) => {
        const surat = Array.isArray(sig.surat_registrasi) ? sig.surat_registrasi[0] : sig.surat_registrasi;
        if (!surat || sig.step_order !== surat.current_step) return null;

        return {
          ...sig,
          surat_registrasi: {
            ...surat,
            file_path: surat.file_path ? `${surat.file_path}?cb=${Date.now()}` : null
          }
        };
      })
      .filter(Boolean);
  },


  /* =========================================================
     UPLOAD FILE
  ========================================================= */

  async uploadFile(file: File) {
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}.${ext}`;

    const filePath = `dokumen/${fileName}`;

    await supabase.storage
      .from("dokumen_surat")
      .upload(filePath, file, { cacheControl: "0" });

    const { data: { publicUrl } } =
      supabase.storage.from("dokumen_surat").getPublicUrl(filePath);

    return publicUrl;
  },

async getAllSurat(userId?: string): Promise<SuratRegistrasi[]> {
  let query = supabase
    .from("surat_registrasi")
    .select(`
      *,
      surat_signatures (
        id,
        user_id,
        role_name,
        step_order,
        is_signed,
        signed_at,
        profiles:user_id (full_name)
      )
    `);

  // Jika userId dikirim, filter hanya surat milik user tersebut
  if (userId) {
    query = query.eq('created_by', userId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []) as SuratRegistrasi[];
},

async getMasterData() {
    const [entities, offices, depts, types, profiles, projects, penggunaan] = await Promise.all([
      supabase.from("master_entities").select("*"),
      supabase.from("master_offices").select("*"),
      supabase.from("master_departments").select("*"),
      supabase.from("master_letter_types").select("*"),
      supabase.from("profiles").select("id, full_name").order("full_name", { ascending: true }),
      supabase.from("master_projects").select("*").order("name", { ascending: true }),
      // Sekarang menarik semua penggunaan agar bisa dipilih siapapun
      supabase.from("master_penggunaan_detail").select("*").order("penggunaan", { ascending: true })
    ]);

    return {
      entities: entities.data || [],
      offices: offices.data || [],
      depts: depts.data || [],
      types: types.data || [],
      users: profiles.data || [],
      projects: projects.data || [], // Tambahkan daftar proyek ke UI
      penggunaan: penggunaan.data || [] // Tambahkan daftar penggunaan ke UI
    };
  },

async downloadFilledTemplate(payload: any, templateLink: string) {
  try {
    // 1. Ambil Nama Label untuk mengisi L4 dan L5
    const [officeRes, projectRes, deptRes] = await Promise.all([
      payload.office_id && payload.office_id !== "pusat" 
        ? supabase.from("master_offices").select("name").eq("id", payload.office_id).maybeSingle() 
        : Promise.resolve({ data: null }),
      payload.project_id 
        ? supabase.from("master_projects").select("name").eq("id", payload.project_id).maybeSingle() 
        : Promise.resolve({ data: null }),
      supabase.from("master_departments").select("name").eq("id", payload.dept_id).maybeSingle()
    ]);

    // 2. Fetch file dari URL publik Supabase
    const response = await fetch(templateLink);
    if (!response.ok) throw new Error("Gagal mengunduh template. Pastikan koneksi internet stabil.");
    
    const arrayBuffer = await response.arrayBuffer();

    // 3. Inisialisasi ExcelJS
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) throw new Error("Sheet tidak ditemukan di dalam file template.");

    // 4. Injeksi Data sesuai permintaan Anda
    // Cell D5: No Surat (Contoh: ": 001/UAI/...")
    worksheet.getCell("D5").value = `: ${payload.no_surat}`;

    if (payload.office_id && payload.office_id !== "pusat") {
      // Jika Cabang
      const namaCabang = officeRes?.data?.name || "";
      const namaProyek = projectRes?.data?.name || "";
      worksheet.getCell("L4").value = `: KC. ${namaCabang}`;
      worksheet.getCell("L5").value = `: ${namaProyek}`;
    } else {
      // Jika Pusat
      const namaDept = deptRes?.data?.name || "";
      worksheet.getCell("L4").value = `: ${namaDept}`;
      worksheet.getCell("L5").value = ": -";
    }

    // 5. Proses Pembuatan File Baru (Download)
    const buffer = await workbook.xlsx.writeBuffer();
    const downloadBlob = new Blob([buffer], { 
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
    });
    
    const url = window.URL.createObjectURL(downloadBlob);
    const a = document.createElement("a");
    a.href = url;
    // Format nama file: NoSurat_Tanggal.xlsx
    const cleanNoSurat = payload.no_surat.replace(/[/\\?%*:|"<>]/g, '-');
    a.download = `Form_${cleanNoSurat}.xlsx`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    return true;
  } catch (error: any) {
    console.error("Excel Processing Error:", error);
    throw new Error(error.message || "Gagal memproses file Excel.");
  }
},

  getPreviewUrl(publicUrl: string) {
  if (!publicUrl) return "";
  // Menggunakan Google Docs Viewer (paling stabil untuk Excel)
  return `https://docs.google.com/viewer?url=${encodeURIComponent(publicUrl)}&embedded=true`;
}

};