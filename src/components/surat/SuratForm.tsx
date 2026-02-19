import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Landmark, Users, Download, FileUp, Hash, ArrowDown, FileCheck, Loader2, Briefcase, FileText, AlertCircle, Copy, Check
} from "lucide-react";
import { suratService } from "@/services/surat.service";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SuratFormProps {
  onSuccess: (noSurat: string, judul: string) => void;
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
  setJudulForDisplay: (val: string) => void;
}

export function SuratForm({ onSuccess, isLoading, setIsLoading, setJudulForDisplay }: SuratFormProps) {
  const { toast } = useToast();
  const [master, setMaster] = useState<any>({
    entities: [], depts: [], offices: [], types: [], users: [], projects: []
  });

  const [usageDetails, setUsageDetails] = useState<any[]>([]);
  const [selectedUsage, setSelectedUsage] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [generatedNoSurat, setGeneratedNoSurat] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [formData, setFormData] = useState({
    entity_id: "",
    dept_id: "",
    letter_type_id: "",
    office_id: "pusat",
    project_id: "",
    judul_surat: "",
    penggunaan_id: ""
  });

  const [signers, setSigners] = useState<any[]>([]);

  // 1. Load Master Data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const data = await suratService.getMasterData();
        setMaster(data);
      } catch (error) {
        console.error("Error fetch master:", error);
      }
    };
    fetchInitialData();
  }, []);

  // 2. Load Penggunaan Detail
  useEffect(() => {
    const fetchUsageGlobal = async () => {
      const { data, error } = await supabase
        .from('master_penggunaan_detail')
        .select(`
          *,
          master_forms (
            id,
            department_id,
            link_form
          )
        `);

      if (!error) setUsageDetails(data || []);
    };
    fetchUsageGlobal();
  }, []);

  const handleUsageChange = (val: string) => {
    const detail = usageDetails.find(u => u.id === val);
    if (detail) {
      setSelectedUsage(detail);
      setFormData(prev => ({ ...prev, penggunaan_id: val }));
      
      const roles = [
        ...(detail.membuat ? [detail.membuat] : []),
        ...(detail.memeriksa ? detail.memeriksa.split(', ') : []),
        ...(detail.menyetujui ? detail.menyetujui.split(', ') : [])
      ];
      
      setSigners(roles.map((r, i) => ({ 
        role_name: r.replace('- ', '').trim(), 
        user_id: "", 
        step_order: i + 1 
      })));
    }
  };

  const handleCopy = async () => {
    if (generatedNoSurat) {
      await navigator.clipboard.writeText(generatedNoSurat);
      setIsCopied(true);
      toast({ title: "Copied!", description: "Nomor surat berhasil disalin." });
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleBookingNumber = async () => {
    if (formData.office_id !== "pusat" && !formData.project_id) {
      return toast({ variant: "destructive", title: "Proyek Wajib", description: "Pilih proyek untuk lokasi cabang." });
    }
    if (!formData.entity_id || !formData.letter_type_id || !formData.dept_id) {
      return toast({ variant: "destructive", title: "Data Belum Lengkap", description: "Lengkapi klasifikasi dokumen." });
    }

    setIsBooking(true);
    try {
      const data = await suratService.generateNoSurat(formData);
      setGeneratedNoSurat(data);
      toast({ 
        title: "Nomor Berhasil Di-booking", 
        description: `Nomor ${data} telah diamankan untuk Anda.` 
      });
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: "Booking Gagal", 
        description: e.message || "Gagal mengambil nomor urut." 
      });
    } finally {
      setIsBooking(false);
    }
  };

  /**
   * FUNGSI UBAH DATA (CANCEL RESERVATION)
   * Mengembalikan nomor ke status CANCELLED agar bisa digunakan orang lain
   */
  const handleUbahData = async () => {
    if (generatedNoSurat) {
      try {
        const noUrut = parseInt(generatedNoSurat.split('/')[0]);
        await supabase
          .from('surat_reservations')
          .update({ status: 'CANCELLED' })
          .match({ 
            entity_id: formData.entity_id, 
            type_id: formData.letter_type_id, 
            year: new Date().getFullYear(),
            no_urut: noUrut 
          });
      } catch (err) {
        console.error("Gagal membatalkan reservasi:", err);
      }
    }
    
    // Reset States
    setGeneratedNoSurat(null);
    setFile(null);
    setSelectedUsage(null);
    setSigners([]);
  };

  const handleDownloadTemplate = async () => {
    if (!selectedUsage?.master_forms?.link_form || !generatedNoSurat) {
      return toast({ variant: "destructive", title: "Error", description: "Template atau Nomor Surat belum siap." });
    }

    setIsDownloading(true);
    try {
      await suratService.downloadFilledTemplate(
        { ...formData, no_surat: generatedNoSurat }, 
        selectedUsage.master_forms.link_form
      );
      toast({ title: "Template Siap", description: "Nomor surat & lokasi telah terisi otomatis." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal", description: "Template tidak dapat diproses." });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSubmit = async () => {
    if (!file) return toast({ variant: "destructive", title: "File Kosong", description: "Upload dokumen terlebih dahulu!" });
    if (signers.some(s => !s.user_id)) return toast({ variant: "destructive", title: "Pejabat Kosong", description: "Lengkapi semua pejabat penandatangan!" });
    
    setIsLoading(true);
    try {
      const result = await suratService.createRegistrasi({
        ...formData,
        no_surat: generatedNoSurat
      }, signers, file);

      if (result) {
        toast({ title: "Berhasil!", description: "Dokumen telah dikirim untuk approval." });
        onSuccess(result.no_surat, formData.judul_surat);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal Simpan", description: error.message || "Terjadi kesalahan sistem." });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDepts = master.depts.filter((d: any) => {
    const isCabangOffice = formData.office_id !== "pusat";
    return isCabangOffice ? d.name.includes("(Cabang)") : !d.name.includes("(Cabang)");
  });

  return (
    <Card className="glass-card border-none overflow-hidden shadow-2xl">
      <CardHeader className="bg-gradient-to-r from-primary/10 via-transparent to-transparent border-b border-border/50">
        <CardTitle className="text-xl font-black flex items-center gap-3 tracking-tight">
          <div className="p-2.5 bg-primary/20 rounded-xl shadow-inner"><FileText className="w-5 h-5 text-primary" /></div>
          REGISTRASI DOKUMEN DIGITAL
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6 md:p-10 space-y-12">
        
        {/* SECTION 1: KLASIFIKASI */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-black shadow-lg shadow-primary/30">1</span>
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Klasifikasi & Lokasi</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-3xl bg-muted/30 border border-border/50 backdrop-blur-sm">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-tighter ml-1">Entitas Pemilik Dokumen</Label>
              <Select disabled={!!generatedNoSurat} onValueChange={(v) => setFormData({...formData, entity_id: v})}>
                <SelectTrigger className="h-11 bg-background/50 border-none ring-1 ring-border shadow-sm"><SelectValue placeholder="Pilih PT" /></SelectTrigger>
                <SelectContent>{master.entities?.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.code} - {e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-tighter ml-1">Lokasi Penerbitan</Label>
              <Select disabled={!!generatedNoSurat} value={formData.office_id} onValueChange={(v) => setFormData({...formData, office_id: v, project_id: "", dept_id: ""})}>
                <SelectTrigger className="h-11 bg-background/50 border-none ring-1 ring-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pusat">Kantor Pusat</SelectItem>
                  {master.offices?.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {formData.office_id !== "pusat" && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                <Label className="text-[11px] font-black uppercase text-primary ml-1 flex items-center gap-2 italic">
                  <Briefcase className="w-3 h-3" /> Wajib Pilih Proyek
                </Label>
                <Select disabled={!!generatedNoSurat} onValueChange={(v) => setFormData({...formData, project_id: v})}>
                  <SelectTrigger className="h-11 border-primary/40 bg-primary/5"><SelectValue placeholder="Pilih proyek lokasi..." /></SelectTrigger>
                  <SelectContent>{master.projects?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-tighter ml-1">Departemen Terkait</Label>
              <Select disabled={!!generatedNoSurat} value={formData.dept_id} onValueChange={(v) => setFormData({...formData, dept_id: v})}>
                <SelectTrigger className="h-11 bg-background/50 border-none ring-1 ring-border"><SelectValue placeholder="Pilih Dept" /></SelectTrigger>
                <SelectContent>{filteredDepts.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-tighter ml-1">Kategori Dokumen</Label>
              <Select disabled={!!generatedNoSurat} onValueChange={(v) => setFormData({...formData, letter_type_id: v})}>
                <SelectTrigger className="h-11 bg-background/50 border-none ring-1 ring-border"><SelectValue placeholder="Pilih Jenis" /></SelectTrigger>
                <SelectContent>{master.types?.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.code} - {t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {!generatedNoSurat ? (
            <Button 
              onClick={handleBookingNumber} 
              disabled={isBooking || !formData.entity_id || !formData.dept_id || !formData.letter_type_id} 
              className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-2xl shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 active:scale-95"
            >
              {isBooking ? <Loader2 className="animate-spin mr-2" /> : <><Hash className="w-5 h-5 mr-2" /> BOOKING NOMOR SURAT</>}
            </Button>
          ) : (
            <div className="p-6 rounded-3xl bg-primary/10 border-2 border-primary/20 flex items-center justify-between animate-in zoom-in-95 duration-500 shadow-inner">
              <div className="flex gap-4 items-center">
                <div className="p-3 bg-primary rounded-2xl text-primary-foreground shadow-lg shadow-primary/30"><Hash className="w-6 h-6" /></div>
                <div>
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-0.5">Booking Registered</p>
                  <div className="flex items-center gap-3">
                    <p className="text-3xl font-black tracking-tighter text-foreground">{generatedNoSurat}</p>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={handleCopy} 
                      className="h-8 w-8 rounded-lg border-primary/20 text-primary hover:bg-primary hover:text-white transition-colors"
                    >
                      {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleUbahData} className="text-primary hover:bg-primary/10 font-bold rounded-xl border border-primary/20">Ubah Data</Button>
            </div>
          )}
        </section>

        {/* SECTION 2: DETAIL & UPLOAD */}
        {generatedNoSurat && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-black">2</span>
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Detail Dokumen & File</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase ml-1">Matrix Persetujuan (Workflow)</Label>
                  <Select onValueChange={handleUsageChange}>
                    <SelectTrigger className="h-12 bg-muted/50 border-none ring-1 ring-border rounded-xl">
                      <SelectValue placeholder="Pilih Matrix..." />
                    </SelectTrigger>
                    <SelectContent>
                      {usageDetails.map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>{u.penggunaan}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase ml-1">Perihal Dokumen</Label>
                  <Input 
                    className="h-12 bg-muted/50 border-none ring-1 ring-border rounded-xl font-medium" 
                    placeholder="Contoh: Permohonan Pembayaran Tagihan..." 
                    onChange={(e) => {
                      setFormData({...formData, judul_surat: e.target.value});
                      setJudulForDisplay(e.target.value);
                    }} 
                  />
                </div>

                {selectedUsage?.master_forms?.link_form && (
                  <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex flex-col gap-3">
                    <p className="text-[10px] font-bold text-amber-600 flex items-center gap-2">
                      <AlertCircle className="w-3 h-3" /> 1. Isi detail perihal di template Excel:
                    </p>
                    
                    <Button 
                      variant="outline" 
                      className="w-full border-amber-500/30 text-amber-700 font-bold h-10 rounded-xl hover:bg-amber-500/10"
                      disabled={isDownloading}
                      onClick={handleDownloadTemplate}
                    >
                      {isDownloading ? (
                        <Loader2 className="animate-spin w-4 h-4 mr-2" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Download & Isi Template (.xlsx)
                    </Button>
                    
                    <p className="text-[9px] text-amber-600/60 italic leading-tight">
                      *Sistem telah mengisi Cell D5 (No Surat), L4 (Unit/KC), dan L5 (Proyek) secara otomatis.
                    </p>
                  </div>
                )}
              </div>

              {/* DROPZONE AREA */}
              <div className={cn(
                "relative group border-3 border-dashed rounded-3xl transition-all duration-500 flex flex-col items-center justify-center p-10 overflow-hidden",
                file ? "border-primary bg-primary/[0.02]" : "border-muted-foreground/20 bg-muted/20 hover:border-primary/40"
              )}>
                <input 
                  type="file" 
                  accept=".xlsx" 
                  className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)} 
                />
                <div className={cn(
                  "p-5 rounded-2xl mb-4 transition-all duration-500",
                  file ? "bg-primary text-primary-foreground rotate-0 scale-110" : "bg-background text-muted-foreground rotate-3"
                )}>
                  <FileUp className="w-8 h-8" />
                </div>
                <p className="font-black text-center text-sm">
                  {file ? file.name : "2. Unggah file Excel yang sudah diisi"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-tighter font-bold">
                  Format wajib .xlsx (Maksimal 10MB)
                </p>
                
                {file && (
                  <div className="mt-6 px-4 py-2 bg-emerald-500/10 text-emerald-600 rounded-xl text-[10px] font-black border border-emerald-500/20 flex items-center gap-2 animate-bounce">
                    <FileCheck className="w-4 h-4" /> EXCEL SIAP DIPROSES
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* SECTION 3: SIGNERS FLOW */}
        {signers.length > 0 && file && (
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="flex items-center gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-black">3</span>
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Otorisasi & Approval</h3>
            </div>

            <div className="max-w-2xl mx-auto space-y-4">
              {signers.map((s, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-full group p-6 rounded-3xl bg-card border border-border shadow-sm flex items-center gap-6 transition-all hover:shadow-md hover:border-primary/20">
                    <div className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-muted text-muted-foreground font-black text-xs shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <span className="text-[8px] uppercase opacity-60">Step</span>
                      {s.step_order}
                    </div>
                    
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black tracking-tight uppercase">{s.role_name}</span>
                        <Users className="w-4 h-4 text-muted-foreground/40" />
                      </div>
                      
                      <Select onValueChange={(val) => {
                        const newS = [...signers];
                        newS[i].user_id = val;
                        setSigners(newS);
                      }}>
                        <SelectTrigger className="bg-muted/30 h-11 border-none ring-1 ring-border rounded-xl">
                          <SelectValue placeholder="Pilih Pejabat Penandatangan..." />
                        </SelectTrigger>
                        <SelectContent>
                          {master.users?.map((u: any) => (
                            <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {i < signers.length - 1 && (
                    <div className="py-2">
                      <ArrowDown className="text-primary/20 w-5 h-5" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-border/50">
              <Button 
                className="w-full h-16 bg-primary hover:bg-primary/90 text-primary-foreground text-lg font-black rounded-3xl shadow-2xl shadow-primary/30 transition-all active:scale-[0.98]"
                disabled={isLoading || signers.some(s => !s.user_id) || !formData.judul_surat}
                onClick={handleSubmit}
              >
                {isLoading ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="animate-spin w-6 h-6" />
                    <span>MEMPROSES DOKUMEN...</span>
                  </div>
                ) : (
                  "KONFIRMASI & KIRIM DOKUMEN"
                )}
              </Button>
              <p className="text-center text-[10px] text-muted-foreground mt-4 font-bold uppercase tracking-widest opacity-50">
                Sistem akan otomatis mengirim notifikasi kepada Pemeriksa {signers[1]?.role_name || ''}
              </p>
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}