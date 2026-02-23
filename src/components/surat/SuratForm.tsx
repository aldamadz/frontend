import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Landmark, Users, Download, FileUp, Hash, ArrowDown, FileCheck, Loader2, Briefcase, FileText, AlertCircle, Copy, Check, Search, ChevronDown, X, Paperclip
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
  const [openMatrix, setOpenMatrix] = useState(false);
  const [lampiranFile, setLampiranFile] = useState<File | null>(null);
  
const resetForm = () => {
  // Reset data form utama
  setFormData({
    entity_id: "",
    dept_id: "",
    letter_type_id: "",
    office_id: "pusat",
    project_id: "",
    judul_surat: "",
    penggunaan_id: "",
    is_aset: false
  });

  // Reset state pendukung
  setGeneratedNoSurat(null);
  setFile(null);
  setLampiranFile(null);
  setSelectedUsage(null);
  setSigners([]);
  setJudulForDisplay(""); // Jika perlu mengosongkan tampilan judul di parent
};

  const [formData, setFormData] = useState({
    entity_id: "",
    dept_id: "",
    letter_type_id: "",
    office_id: "pusat",
    project_id: "",
    judul_surat: "",
    penggunaan_id: "",
    is_aset: false
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

  // 2. Load Penggunaan Detail dengan Relasi Eksplisit
  useEffect(() => {
    const fetchUsageGlobal = async () => {
      // Menggunakan !fk_master_forms untuk memastikan Supabase menggunakan join yang benar
      const { data, error } = await supabase
        .from('master_penggunaan_detail')
        .select(`
          *,
          master_forms!fk_master_forms (
            id,
            department_id,
            link_form
          )
        `);

      if (error) {
        console.error("Error fetching usage details:", error);
        toast({ variant: "destructive", title: "Gagal memuat matrix", description: error.message });
      } else {
        setUsageDetails(data || []);
      }
    };
    fetchUsageGlobal();
  }, []);

// Tambahkan fungsi ini
  const handleCopy = async () => {
    if (generatedNoSurat) {
      try {
        await navigator.clipboard.writeText(generatedNoSurat);
        setIsCopied(true);
        toast({ 
          title: "Berhasil!", 
          description: "Nomor surat telah disalin ke clipboard." 
        });
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        toast({ 
          variant: "destructive", 
          title: "Gagal menyalin", 
          description: "Silakan salin secara manual." 
        });
      }
    }
  };

  // Filter Departemen (Pusat vs Cabang)
  const filteredDepts = useMemo(() => {
    const isCabangOffice = formData.office_id !== "pusat";
    return master.depts.filter((d: any) => {
      return isCabangOffice ? d.name.includes("(Cabang)") : !d.name.includes("(Cabang)");
    });
  }, [master.depts, formData.office_id]);

  // Filter Proyek berdasarkan Kantor Cabang
  const filteredProjects = useMemo(() => {
    if (formData.office_id === "pusat") return [];
    return master.projects.filter((p: any) => p.office_id === formData.office_id);
  }, [master.projects, formData.office_id]);

  const handleClearUsage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData(prev => ({ ...prev, penggunaan_id: "" }));
    setSelectedUsage(null);
    setSigners([]);
    setLampiranFile(null);
  };

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

  const handleBookingNumber = async () => {
    if (formData.office_id !== "pusat" && !formData.project_id) {
      return toast({ variant: "destructive", title: "Proyek Wajib", description: "Pilih proyek untuk lokasi cabang." });
    }
    setIsBooking(true);
    try {
      const data = await suratService.generateNoSurat(formData);
      setGeneratedNoSurat(data);
      toast({ title: "Booking Berhasil", description: `Nomor: ${data}` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Booking Gagal", description: e.message });
    } finally {
      setIsBooking(false);
    }
  };

  const handleUbahData = async () => {
    // Logika pembatalan reservasi jika perlu bisa ditaruh di sini
    setGeneratedNoSurat(null);
    setFile(null);
    setSelectedUsage(null);
    setSigners([]);
    setLampiranFile(null);
  };

  const handleDownloadTemplate = async () => {
    if (!selectedUsage?.master_forms?.link_form || !generatedNoSurat) {
      return toast({ variant: "destructive", title: "Error", description: "Template tidak tersedia." });
    }
    setIsDownloading(true);
    try {
      await suratService.downloadFilledTemplate(
        { ...formData, no_surat: generatedNoSurat }, 
        selectedUsage.master_forms.link_form
      );
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal", description: "Template gagal diunduh." });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSubmit = async () => {
    if (!file) return toast({ variant: "destructive", title: "File Utama Wajib" });
    if (selectedUsage?.lampiran_wajib && !lampiranFile) {
        return toast({ variant: "destructive", title: "Lampiran Wajib Kurang" });
    }
    if (signers.some(s => !s.user_id)) return toast({ variant: "destructive", title: "Pejabat Belum Lengkap" });

    setIsLoading(true);
    try {
      const result = await suratService.createRegistrasi({
        ...formData,
        no_surat: generatedNoSurat
      }, signers, file, lampiranFile); 

      if (result) {
        toast({ title: "Berhasil", description: "Dokumen berhasil didaftarkan" });
        resetForm();
        onSuccess(result.no_surat, formData.judul_surat);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal Simpan", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="glass-card border-none overflow-hidden shadow-2xl">
      <CardHeader className="bg-gradient-to-r from-primary/10 via-transparent to-transparent border-b border-border/50">
        <CardTitle className="text-xl font-black flex items-center gap-3 tracking-tight uppercase">
          <div className="p-2.5 bg-primary/20 rounded-xl shadow-inner"><FileText className="w-5 h-5 text-primary" /></div>
          Registrasi Dokumen Digital
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
              <Label className="text-[11px] font-black uppercase tracking-tighter ml-1">Entitas</Label>
              <Select disabled={!!generatedNoSurat} value={formData.entity_id} onValueChange={(v) => setFormData({...formData, entity_id: v})}>
                <SelectTrigger className="h-11 bg-background/50 border-none ring-1 ring-border"><SelectValue placeholder="Pilih PT" /></SelectTrigger>
                <SelectContent>{master.entities?.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.code} - {e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-tighter ml-1">Lokasi Penerbitan</Label>
              <Select 
                disabled={!!generatedNoSurat} 
                value={formData.office_id} 
                onValueChange={(v) => setFormData({...formData, office_id: v, project_id: "", dept_id: ""})}
              >
                <SelectTrigger className="h-11 bg-background/50 border-none ring-1 ring-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pusat">Kantor Pusat</SelectItem>
                  {master.offices?.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {formData.office_id !== "pusat" && (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <Label className="text-[11px] font-black uppercase text-primary ml-1 flex items-center gap-2">
                  <Briefcase className="w-3 h-3" /> Wajib Pilih Proyek
                </Label>
                <Select 
                  disabled={!!generatedNoSurat} 
                  value={formData.project_id}
                  onValueChange={(v) => setFormData({...formData, project_id: v})}
                >
                  <SelectTrigger className="h-11 border-primary/40 bg-primary/5">
                    <SelectValue placeholder="Pilih proyek..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredProjects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-tighter ml-1">Departemen</Label>
              <Select disabled={!!generatedNoSurat} value={formData.dept_id} onValueChange={(v) => setFormData({...formData, dept_id: v})}>
                <SelectTrigger className="h-11 bg-background/50 border-none ring-1 ring-border"><SelectValue placeholder="Pilih Dept" /></SelectTrigger>
                <SelectContent>{filteredDepts.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-tighter ml-1">Kategori Dokumen</Label>
              <Select disabled={!!generatedNoSurat} value={formData.letter_type_id} onValueChange={(v) => setFormData({...formData, letter_type_id: v})}>
                <SelectTrigger className="h-11 bg-background/50 border-none ring-1 ring-border"><SelectValue placeholder="Pilih Jenis" /></SelectTrigger>
                <SelectContent>{master.types?.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.code} - {t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
<div className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/10 mb-4">
  <div className="space-y-0.5">
    <Label className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
      <Landmark className="w-4 h-4 text-primary" /> Dokumen Terkait Aset?
    </Label>
    <p className="text-[10px] text-muted-foreground font-medium">
      Aktifkan jika dokumen ini berhubungan dengan inventaris/aset perusahaan.
    </p>
  </div>
  <Switch 
    disabled={!!generatedNoSurat}
    checked={formData.is_aset}
    onCheckedChange={(val) => setFormData({...formData, is_aset: val})}
  />
</div>
          {!generatedNoSurat ? (
            <Button 
              onClick={handleBookingNumber} 
              disabled={isBooking || !formData.entity_id || !formData.dept_id || !formData.letter_type_id || (formData.office_id !== "pusat" && !formData.project_id)} 
              className="w-full h-14 bg-primary font-black rounded-2xl shadow-xl shadow-primary/20 transition-all hover:-translate-y-1"
            >
              {isBooking ? <Loader2 className="animate-spin mr-2" /> : <><Hash className="w-5 h-5 mr-2" /> BOOKING NOMOR SURAT</>}
            </Button>
          ) : (
            <div className="p-6 rounded-3xl bg-primary/10 border-2 border-primary/20 flex items-center justify-between animate-in zoom-in-95 shadow-inner">
              <div className="flex gap-4 items-center">
                <div className="p-3 bg-primary rounded-2xl text-primary-foreground shadow-lg"><Hash className="w-6 h-6" /></div>
                <div>
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">Booking Registered</p>
                  <div className="flex items-center gap-3">
                    <p className="text-3xl font-black tracking-tighter">{generatedNoSurat}</p>
                    <Button variant="outline" size="icon" onClick={handleCopy} className="h-8 w-8">
                      {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <Button variant="ghost" onClick={handleUbahData} className="text-primary font-bold">Ubah Data</Button>
            </div>
          )}
        </section>

        {/* SECTION 2: DETAIL & UPLOAD */}
        {generatedNoSurat && (
          <section className="space-y-6 animate-in slide-in-from-bottom-5 duration-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-black">2</span>
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Detail Dokumen & File</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase ml-1">Matrix Persetujuan</Label>
                  <Popover open={openMatrix} onOpenChange={setOpenMatrix}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full h-12 justify-between bg-muted/50 border-none ring-1 ring-border rounded-xl">
                        <span className="truncate">{formData.penggunaan_id ? usageDetails.find(u => u.id === formData.penggunaan_id)?.penggunaan : "Pilih Matrix..."}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {formData.penggunaan_id && <X className="h-3 w-3 mr-1" onClick={handleClearUsage} />}
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </div>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Cari matrix..." />
                        <CommandList>
                          <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                          <CommandGroup>
                            {usageDetails.map((u: any) => (
                              <CommandItem key={u.id} value={u.penggunaan} onSelect={() => { handleUsageChange(u.id); setOpenMatrix(false); }}>
                                <Check className={cn("mr-2 h-4 w-4", formData.penggunaan_id === u.id ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col">
                                    <span className="font-bold">{u.penggunaan}</span>
                                    <span className="text-[10px] opacity-60">{u.membuat} → {u.menyetujui}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase ml-1">Perihal Dokumen</Label>
                  <Input 
                    className="h-12 bg-muted/50 border-none ring-1 ring-border rounded-xl" 
                    placeholder="Contoh: Permohonan Pembayaran..." 
                    value={formData.judul_surat}
                    onChange={(e) => { setFormData({...formData, judul_surat: e.target.value}); setJudulForDisplay(e.target.value); }} 
                  />
                </div>

                {selectedUsage?.master_forms?.link_form && (
                  <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                    <p className="text-[10px] font-bold text-amber-600 flex items-center gap-2 uppercase tracking-tighter">
                      <AlertCircle className="w-3 h-3" /> 1. Download & Isi Template
                    </p>
                    <Button variant="outline" className="w-full border-amber-500/30 text-amber-700 font-bold" disabled={isDownloading} onClick={handleDownloadTemplate}>
                      {isDownloading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                      Download Excel Template
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className={cn("relative group border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center transition-all", file ? "border-primary bg-primary/[0.02]" : "border-muted-foreground/20 bg-muted/20")}>
                  <input type="file" accept=".xlsx" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  <div className={cn("p-4 rounded-2xl mb-3", file ? "bg-primary text-white" : "bg-background text-muted-foreground")}>
                    <FileUp className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-center text-xs truncate max-w-full">{file ? file.name : "2. Unggah file Excel utama"}</p>
                </div>

                {selectedUsage?.lampiran_wajib && (
                  <div className={cn("relative border-2 border-dashed rounded-2xl p-6 flex items-center gap-4 transition-all", lampiranFile ? "border-amber-500 bg-amber-500/5" : "border-amber-500/20 bg-amber-500/[0.02]")}>
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => setLampiranFile(e.target.files?.[0] || null)} />
                    <div className={cn("p-3 rounded-xl", lampiranFile ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-600")}><Paperclip className="w-5 h-5" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black text-amber-600 uppercase">Wajib: {selectedUsage.lampiran_wajib}</p>
                      <p className="text-xs font-bold truncate">{lampiranFile ? lampiranFile.name : "Klik untuk upload"}</p>
                    </div>
                    {lampiranFile && <Check className="w-4 h-4 text-amber-500" />}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* SECTION 3: SIGNERS FLOW */}
        {signers.length > 0 && file && (
          <section className="space-y-8 animate-in slide-in-from-bottom-5 duration-700">
            <div className="flex items-center gap-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-black">3</span>
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Otorisasi & Approval</h3>
            </div>

            <div className="max-w-2xl mx-auto space-y-4">
              {signers.map((s, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-full p-6 rounded-3xl bg-card border border-border shadow-sm flex items-center gap-6">
                    <div className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-muted font-black text-xs shrink-0">
                      <span className="text-[8px] opacity-60">STEP</span>{s.step_order}
                    </div>
                    <div className="flex-1 space-y-3">
                      <span className="text-xs font-black uppercase">{s.role_name}</span>
                      <Select onValueChange={(val) => {
                        const newS = [...signers];
                        newS[i].user_id = val;
                        setSigners(newS);
                      }}>
                        <SelectTrigger className="bg-muted/30 h-11 border-none ring-1 ring-border rounded-xl">
                          <SelectValue placeholder="Pilih Pejabat..." />
                        </SelectTrigger>
                        <SelectContent>{master.users?.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  {i < signers.length - 1 && <ArrowDown className="text-primary/20 w-5 h-5 my-2" />}
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-border/50">
              <Button 
                className="w-full h-16 bg-primary text-lg font-black rounded-3xl shadow-2xl transition-all"
                disabled={isLoading || signers.some(s => !s.user_id) || !formData.judul_surat || (!!selectedUsage?.lampiran_wajib && !lampiranFile)}
                onClick={handleSubmit}
              >
                {isLoading ? <Loader2 className="animate-spin w-6 h-6 mr-3" /> : "KONFIRMASI & KIRIM DOKUMEN"}
              </Button>
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}