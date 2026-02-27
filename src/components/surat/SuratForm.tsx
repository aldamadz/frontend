import React, { useEffect, useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Download, FileUp, Hash, ArrowDown, Loader2, Briefcase, FileText, 
  Check, ChevronDown, Paperclip, Copy, RefreshCcw
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
  
  // Refs untuk reset input file secara fisik
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lampiranInputRef = useRef<HTMLInputElement>(null);

  const [master, setMaster] = useState<any>({
    entities: [], depts: [], offices: [], types: [], users: [], projects: []
  });

  const [usageDetails, setUsageDetails] = useState<any[]>([]);
  const [selectedUsage, setSelectedUsage] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [generatedNoSurat, setGeneratedNoSurat] = useState<string | null>(null);
  const [isProcessingNumber, setIsProcessingNumber] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [openMatrix, setOpenMatrix] = useState(false);
  const [lampiranFile, setLampiranFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    entity_id: "",
    dept_id: "",
    letter_type_id: "",
    office_id: "",
    project_id: "",
    judul_surat: "",
    penggunaan_id: "",
    is_aset: false
  });

  const [signers, setSigners] = useState<any[]>([]);

  // --- FUNGSI RESET FORM ---
  const resetForm = () => {
    const pusat = master.offices.find((o: any) => o.kedudukan === 'Pusat');
    
    setFormData({
      entity_id: "",
      dept_id: "",
      letter_type_id: "",
      office_id: pusat?.id || "",
      project_id: "",
      judul_surat: "",
      penggunaan_id: "",
      is_aset: false
    });

    setGeneratedNoSurat(null);
    setSelectedUsage(null);
    setFile(null);
    setLampiranFile(null);
    setSigners([]);
    setJudulForDisplay("");
    
    // Reset nilai input file di DOM
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (lampiranInputRef.current) lampiranInputRef.current.value = "";
  };

  // 1. Ambil Data Master
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const data = await suratService.getMasterData();
        setMaster(data);
        const pusat = data.offices.find((o: any) => o.kedudukan === 'Pusat');
        if (pusat) {
          setFormData(prev => ({ ...prev, office_id: pusat.id }));
        }
      } catch (error) {
        console.error("Gagal memuat data master");
      }
    };
    fetchInitialData();
  }, []);

  // 2. Ambil Matrix Penggunaan
  useEffect(() => {
    const fetchUsageGlobal = async () => {
      const { data, error } = await supabase
        .from('master_penggunaan_detail')
        .select(`*, master_forms!fk_master_forms (id, department_id, link_form)`);
      if (error) {
        toast({ variant: "destructive", title: "Gagal memuat daftar penggunaan" });
      } else {
        setUsageDetails(data || []);
      }
    };
    fetchUsageGlobal();
  }, [toast]);

  // 3. Auto-select Entity saat Proyek dipilih
  useEffect(() => {
    if (formData.project_id) {
      const selectedProj = master.projects.find((p: any) => p.id === formData.project_id);
      if (selectedProj?.entity_id) {
        setFormData(prev => ({ ...prev, entity_id: selectedProj.entity_id }));
      }
    }
  }, [formData.project_id, master.projects]);

  // 4. Filter Logika Tampilan
  const officePusat = useMemo(() => master.offices.find((o: any) => o.kedudukan === 'Pusat'), [master.offices]);
  const isPusatSelected = formData.office_id === officePusat?.id;

  const filteredDepts = useMemo(() => {
    return master.depts.filter((d: any) => {
      const isCabangDept = d.name.toLowerCase().includes("(cabang)");
      return !isPusatSelected ? isCabangDept : !isCabangDept;
    });
  }, [master.depts, isPusatSelected]);

  const filteredProjects = useMemo(() => {
    if (isPusatSelected) return [];
    return master.projects.filter((p: any) => p.office_id === formData.office_id);
  }, [master.projects, formData.office_id, isPusatSelected]);

  // 5. Handlers
  const handleGetNumber = async () => {
    if (!isPusatSelected && !formData.project_id) {
      return toast({ variant: "destructive", title: "Proyek Belum Dipilih", description: "Silakan pilih proyek terlebih dahulu." });
    }
    
    setIsProcessingNumber(true);
    try {
      const res = await suratService.generateNoSurat(formData);
      setGeneratedNoSurat(res.fullNumber);
      toast({ title: "Nomor Berhasil Didapatkan", description: `Nomor urut ${res.noUrut} siap digunakan.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal Mendapatkan Nomor", description: "Sistem tidak dapat menerbitkan nomor saat ini." });
    } finally { setIsProcessingNumber(false); }
  };

  const handleResetNumber = async () => {
    if (generatedNoSurat) {
      try {
        await suratService.cancelRegistration(generatedNoSurat);
        // Kembali ke state awal nomor
        setGeneratedNoSurat(null);
        setJudulForDisplay("");
        toast({ description: "Nomor sebelumnya telah dibatalkan." });
      } catch (error) {
        toast({ variant: "destructive", title: "Gagal membatalkan nomor" });
      }
    }
  };

  const handleUsageChange = (val: string) => {
    const detail = usageDetails.find(u => u.id === val);
    if (detail) {
      setSelectedUsage(detail);
      setFormData(prev => ({ ...prev, penggunaan_id: val }));
      const parseRoles = (str: string) => str ? str.split(',').map(s => s.trim()).filter(s => s !== "") : [];
      const combinedRoles = [...parseRoles(detail.membuat), ...parseRoles(detail.memeriksa), ...parseRoles(detail.menyetujui)];
      setSigners(combinedRoles.map((role, i) => ({ role_name: role, user_id: "", step_order: i + 1 })));
    }
  };

  const handleCopy = async () => {
    if (generatedNoSurat) {
      await navigator.clipboard.writeText(generatedNoSurat);
      setIsCopied(true);
      toast({ title: "Berhasil Disalin" });
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleDownloadTemplate = async () => {
    if (!formData.judul_surat) return toast({ variant: "destructive", title: "Perihal Kosong" });
    setIsDownloading(true);
    try {
      await suratService.downloadFilledTemplate({ ...formData, no_surat: generatedNoSurat }, selectedUsage.master_forms.link_form);
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal Mengunduh Template" });
    } finally { setIsDownloading(false); }
  };

  const handleSubmit = async () => {
    if (!file) return toast({ variant: "destructive", title: "File Belum Diunggah" });
    
    setIsLoading(true);
    try {
      const payload = { ...formData, no_surat: generatedNoSurat };
      const result = await suratService.createRegistrasi(payload, signers, file, lampiranFile); 
      
      if (result) {
        toast({ title: "Pendaftaran Berhasil", description: "Halaman dikosongkan untuk input baru." });
        
        // Simpan referensi data sebelum direset untuk callback
        const savedNoSurat = result.no_surat;
        const savedJudul = formData.judul_surat;

        // RESET FORM TOTAL
        resetForm();

        // Jalankan callback sukses
        onSuccess(savedNoSurat, savedJudul);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal Menyimpan", description: error.message });
    } finally { 
      setIsLoading(false); 
    }
  };

  return (
    <Card className="glass-card border-none overflow-hidden shadow-2xl bg-background/50 backdrop-blur-xl">
      <CardHeader className="bg-gradient-to-r from-primary/10 via-transparent to-transparent border-b border-border/50">
        <CardTitle className="text-xl font-black flex items-center gap-3 tracking-tight uppercase">
          <div className="p-2.5 bg-primary/20 rounded-xl shadow-inner">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          Registrasi Dokumen Digital
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6 md:p-10 space-y-12">
        {/* BAGIAN 1: IDENTITAS & NOMOR */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-black shadow-lg">1</span>
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Lokasi & Klasifikasi</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-3xl bg-muted/30 border border-border/50">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground ml-1">Kantor Penerbit</Label>
              <Select 
                disabled={!!generatedNoSurat} 
                value={formData.office_id} 
                onValueChange={(v) => setFormData({...formData, office_id: v, project_id: "", dept_id: ""})}
              >
                <SelectTrigger className="h-11 bg-background/50 border-none ring-1 ring-border">
                  <SelectValue placeholder="Pilih Kantor..." />
                </SelectTrigger>
                <SelectContent>
                  {master.offices?.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.kedudukan === 'Pusat' ? "Kantor Pusat" : `${o.kedudukan}. ${o.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isPusatSelected && formData.office_id && (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <Label className="text-[11px] font-black uppercase text-primary ml-1 flex items-center gap-2">
                  <Briefcase className="w-3 h-3" /> Pilih Proyek Cabang
                </Label>
                <Select 
                  disabled={!!generatedNoSurat} 
                  value={formData.project_id} 
                  onValueChange={(v) => setFormData({...formData, project_id: v})}
                >
                  <SelectTrigger className="h-11 border-primary/40 bg-primary/5">
                    <SelectValue placeholder="Pilih Proyek..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredProjects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground ml-1">Entitas (PT)</Label>
              <Select disabled={!!generatedNoSurat} value={formData.entity_id} onValueChange={(v) => setFormData({...formData, entity_id: v})}>
                <SelectTrigger className="h-11 bg-background/50 border-none ring-1 ring-border">
                  <SelectValue placeholder="Pilih PT..." />
                </SelectTrigger>
                <SelectContent>
                  {master.entities?.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.code} - {e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground ml-1">Departemen</Label>
              <Select disabled={!!generatedNoSurat} value={formData.dept_id} onValueChange={(v) => setFormData({...formData, dept_id: v})}>
                <SelectTrigger className="h-11 bg-background/50 border-none ring-1 ring-border">
                  <SelectValue placeholder="Pilih Dept..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredDepts.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground ml-1">Jenis Dokumen</Label>
              <Select disabled={!!generatedNoSurat} value={formData.letter_type_id} onValueChange={(v) => setFormData({...formData, letter_type_id: v})}>
                <SelectTrigger className="h-11 bg-background/50 border-none ring-1 ring-border">
                  <SelectValue placeholder="Pilih Jenis..." />
                </SelectTrigger>
                <SelectContent>
                  {master.types?.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.code} - {t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!generatedNoSurat ? (
            <Button 
              onClick={handleGetNumber} 
              disabled={isProcessingNumber || !formData.entity_id || !formData.dept_id || !formData.letter_type_id} 
              className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-lg transition-transform hover:-translate-y-1"
            >
              {isProcessingNumber ? <Loader2 className="animate-spin mr-2" /> : <><Hash className="w-5 h-5 mr-2" /> DAPATKAN NOMOR SURAT</>}
            </Button>
          ) : (
            <div className="p-6 rounded-3xl bg-primary/10 border-2 border-primary/20 flex flex-col md:flex-row items-center justify-between gap-4 animate-in zoom-in-95">
              <div className="flex gap-4 items-center">
                <div className="p-3 bg-primary rounded-2xl text-primary-foreground shadow-lg"><Hash className="w-6 h-6" /></div>
                <div>
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">Nomor Telah Dialokasikan</p>
                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-black tracking-tighter">{generatedNoSurat}</p>
                    <Button variant="outline" size="icon" onClick={handleCopy} className="h-8 w-8 hover:bg-primary hover:text-white transition-colors">
                      {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <Button variant="outline" onClick={handleResetNumber} className="border-primary text-primary font-bold hover:bg-primary/5 rounded-xl">
                <RefreshCcw className="w-4 h-4 mr-2" /> Ubah Data Kantor
              </Button>
            </div>
          )}
        </section>

        {/* BAGIAN 2 & 3: DETAIL & PERSETUJUAN */}
        {generatedNoSurat && (
          <div className="space-y-12 animate-in slide-in-from-bottom-5 duration-500">
            <section className="space-y-6">
              <div className="flex items-center gap-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-black">2</span>
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Isi Dokumen & Matrix</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase ml-1 text-muted-foreground">Pilih Alur Persetujuan (Matrix)</Label>
                    <Popover open={openMatrix} onOpenChange={setOpenMatrix}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full h-12 justify-between rounded-xl ring-1 ring-border border-none bg-muted/20 text-left">
                          <span className="truncate">{formData.penggunaan_id ? usageDetails.find(u => u.id === formData.penggunaan_id)?.penggunaan : "Cari Matrix..."}</span>
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Cari penggunaan..." />
                          <CommandList>
                            <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                            <CommandGroup>
                              {usageDetails.map((u: any) => (
                                <CommandItem key={u.id} onSelect={() => { handleUsageChange(u.id); setOpenMatrix(false); }}>
                                  <div className="flex flex-col">
                                    <span className="font-bold">{u.penggunaan}</span>
                                    <span className="text-[9px] opacity-60 uppercase">{u.membuat} → {u.menyetujui}</span>
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
                    <Label className="text-[11px] font-black uppercase ml-1 text-muted-foreground">Perihal (Judul Surat)</Label>
                    <Input 
                      className="h-12 rounded-xl ring-1 ring-border border-none bg-muted/20 focus-visible:ring-primary" 
                      placeholder="Contoh: Permohonan Pembelian..." 
                      value={formData.judul_surat} 
                      onChange={(e) => { setFormData({...formData, judul_surat: e.target.value}); setJudulForDisplay(e.target.value); }} 
                    />
                  </div>

                  {selectedUsage?.master_forms?.link_form && (
                    <Button 
                      variant="secondary" 
                      className="w-full h-11 rounded-xl font-black text-xs gap-2 shadow-sm"
                      onClick={handleDownloadTemplate}
                      disabled={isDownloading}
                    >
                      {isDownloading ? <Loader2 className="animate-spin w-4 h-4" /> : <Download className="w-4 h-4" />}
                      UNDUH TEMPLATE OTOMATIS
                    </Button>
                  )}
                </div>

                <div className="space-y-4">
                  <div className={cn(
                    "relative group border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center transition-all min-h-[160px]",
                    file ? "border-primary bg-primary/5" : "border-muted-foreground/20 bg-muted/10"
                  )}>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      accept=".xlsx" 
                      className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                      onChange={(e) => setFile(e.target.files?.[0] || null)} 
                    />
                    <div className={cn("p-4 rounded-2xl mb-2", file ? "bg-primary text-white" : "bg-background text-muted-foreground")}><FileUp className="w-6 h-6" /></div>
                    <p className="font-black text-xs text-center">{file ? file.name : "Unggah Dokumen Excel (.xlsx)"}</p>
                  </div>

                  {selectedUsage?.lampiran_wajib && (
                    <div className={cn(
                      "relative border-2 border-dashed rounded-2xl p-5 flex items-center gap-4",
                      lampiranFile ? "border-amber-500 bg-amber-500/5" : "border-destructive/40 bg-destructive/5"
                    )}>
                      <input 
                        type="file" 
                        ref={lampiranInputRef}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                        onChange={(e) => setLampiranFile(e.target.files?.[0] || null)} 
                      />
                      <div className={cn("p-3 rounded-xl", lampiranFile ? "bg-amber-500 text-white" : "bg-destructive text-white")}><Paperclip className="w-5 h-5" /></div>
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase text-muted-foreground">Lampiran Wajib: {selectedUsage.lampiran_wajib}</p>
                        <p className="text-xs font-bold truncate">{lampiranFile ? lampiranFile.name : "Klik untuk unggah lampiran"}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {signers.length > 0 && file && (
              <section className="space-y-8 pt-6 border-t border-border/50">
                <div className="flex items-center gap-4">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-black">3</span>
                  <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Pejabat Penandatangan</h3>
                </div>
                <div className="max-w-xl mx-auto space-y-4">
                  {signers.map((s, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <div className="w-full p-5 rounded-2xl bg-card border border-border flex items-center gap-5">
                        <div className="flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-muted font-black text-[10px] shrink-0">
                          <span className="opacity-50 text-[7px]">URUTAN</span>{s.step_order}
                        </div>
                        <div className="flex-1 text-left space-y-1">
                          <p className="text-[10px] font-black text-primary uppercase">{s.role_name}</p>
                          <Select value={s.user_id} onValueChange={(val) => {
                            const newS = [...signers];
                            newS[i].user_id = val;
                            setSigners(newS);
                          }}>
                            <SelectTrigger className="h-10 bg-muted/20 border-none ring-1 ring-border rounded-lg">
                              <SelectValue placeholder="Pilih Pejabat..." />
                            </SelectTrigger>
                            <SelectContent>
                              {master.users?.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {i < signers.length - 1 && <ArrowDown className="text-primary/20 w-4 h-4 my-1" />}
                    </div>
                  ))}
                </div>
                <Button 
                  className="w-full h-16 bg-primary text-white text-lg font-black rounded-3xl shadow-2xl mt-6 transition-transform active:scale-95" 
                  disabled={isLoading || signers.some(s => !s.user_id) || !formData.judul_surat || (!!selectedUsage?.lampiran_wajib && !lampiranFile)}
                  onClick={handleSubmit}
                >
                  {isLoading ? <Loader2 className="animate-spin w-6 h-6 mr-3" /> : "KONFIRMASI & SIMPAN DOKUMEN"}
                </Button>
              </section>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}