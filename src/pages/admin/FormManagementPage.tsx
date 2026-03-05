import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  FileText, Plus, Pencil, Trash2, Loader2, 
  ExternalLink, Search, FileSpreadsheet, Upload, CheckCircle2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function FormManagementPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [forms, setForms] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // Progress Bar State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    nama_form: "",
    nomor_form: "",
    link_form: "",
    department_id: "",
    pic_id: ""
  });

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const { data: formsData, error: formsError } = await supabase
        .from("master_forms")
        .select(`
          *,
          master_departments!department_id (id, name, code),
          profiles!pic_id (id, full_name)
        `)
        .order("created_at", { ascending: false });

      if (formsError) throw formsError;

      const [deptsRes, usersRes] = await Promise.all([
        supabase.from("master_departments").select("*").order("name"),
        supabase.from("profiles").select("id, full_name").order("full_name")
      ]);

      setForms(formsData || []);
      setDepartments(deptsRes.data || []);
      setUsers(usersRes.data || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Koneksi Bermasalah", description: error.message });
    } finally { setLoading(false); }
  };

  useEffect(() => { loadInitialData(); }, []);

  // HANDLER UPLOAD FILE DENGAN AUTO-FILL NAMA & PROGRESS BAR
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileNameRaw = file.name;
    const fileExt = fileNameRaw.split('.').pop()?.toLowerCase();
    
    if (fileExt !== 'xlsx' && fileExt !== 'xls') {
      return toast({ variant: "destructive", title: "Format Salah", description: "Hanya file Excel (.xlsx) yang diizinkan." });
    }

    try {
      setIsUploading(true);
      setUploadProgress(10); // Mulai progress

      // 1. Ekstrak nama file untuk Nama Form Resmi
      // Contoh: "Form_Peminjaman_Mobil.xlsx" -> "Form Peminjaman Mobil"
      const baseName = fileNameRaw.replace(/\.[^/.]+$/, ""); 
      const cleanName = baseName
        .replace(/[_-]/g, " ") 
        .replace(/\b\w/g, (l) => l.toUpperCase());

      // 2. Sanitasi nama file untuk storage
      const storagePath = `${Date.now()}_${fileNameRaw.replace(/\s/g, '_')}`;

      // 3. Upload ke Bucket 'templates'
      const { error: uploadError } = await supabase.storage
        .from('templates')
        .upload(storagePath, file, { 
            cacheControl: '3600', 
            upsert: true 
        });

      if (uploadError) throw uploadError;
      
      setUploadProgress(70); // Progress naik setelah upload fisik selesai

      // 4. Ambil Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('templates')
        .getPublicUrl(storagePath);

      // 5. Update State (Link + Nama Otomatis)
      setFormData(prev => ({ 
        ...prev, 
        link_form: publicUrl,
        nama_form: prev.nama_form || cleanName // Isi jika masih kosong
      }));

      setUploadProgress(100);
      toast({ title: "Upload Berhasil", description: "Nama form dan link telah diperbarui." });
      
    } catch (error: any) {
      toast({ variant: "destructive", title: "Upload Gagal", description: error.message });
      setUploadProgress(0);
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 1000);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleOpenModal = (form: any = null) => {
    if (form) {
      setSelectedForm(form);
      setFormData({
        nama_form: form.nama_form,
        nomor_form: form.nomor_form,
        link_form: form.link_form,
        department_id: form.department_id || "",
        pic_id: form.pic_id || ""
      });
    } else {
      setSelectedForm(null);
      setFormData({ nama_form: "", nomor_form: "", link_form: "", department_id: "", pic_id: "" });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.department_id || !formData.pic_id || !formData.nama_form) {
      return toast({ variant: "destructive", title: "Data Tidak Lengkap", description: "Dept, PIC, dan Nama Form wajib diisi." });
    }

    try {
      setLoading(true);
      const { error } = selectedForm 
        ? await supabase.from("master_forms").update(formData).eq("id", selectedForm.id)
        : await supabase.from("master_forms").insert([formData]);

      if (error) throw error;
      toast({ title: "Berhasil", description: "Data template telah disimpan." });
      setIsModalOpen(false);
      loadInitialData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal Menyimpan", description: error.message });
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus template ini secara permanen?")) return;
    try {
      setLoading(true);
      const { error } = await supabase.from("master_forms").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Dihapus", description: "Template berhasil dihapus." });
      loadInitialData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal Menghapus", description: error.message });
    } finally { setLoading(false); }
  };

  const filteredForms = forms.filter(f => 
    f.nama_form?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.master_departments?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-3">
             <div className="p-3 bg-primary rounded-2xl shadow-glow">
                <FileText className="w-6 h-6 text-primary-foreground" />
             </div>
             <h1 className="text-3xl font-black tracking-tighter text-gradient uppercase">Master Template</h1>
          </div>
          <p className="text-muted-foreground font-medium mt-2 ml-1">Pusat kendali template dokumen dan delegasi PIC</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Cari form, dept, atau nama PIC..." 
              className="pl-10 h-12 bg-card/40 border-border/50 rounded-2xl" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={() => handleOpenModal()} className="h-12 px-6 gap-2 font-black text-xs uppercase rounded-2xl glow-effect">
            <Plus className="w-4 h-4" /> Tambah Form
          </Button>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="glass-card rounded-[2rem] overflow-hidden border-border/20 shadow-2xl bg-card/30 backdrop-blur-xl">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="w-[200px] py-6 px-8 font-black text-[10px] tracking-widest uppercase">Departemen</TableHead>
              <TableHead className="font-black text-[10px] tracking-widest uppercase">Detail Dokumen</TableHead>
              <TableHead className="font-black text-[10px] tracking-widest uppercase">PIC Eksekutor</TableHead>
              <TableHead className="text-right px-8 font-black text-[10px] tracking-widest uppercase">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && forms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-32">
                  <Loader2 className="animate-spin mx-auto w-12 h-12 text-primary opacity-20"/>
                </TableCell>
              </TableRow>
            ) : filteredForms.map((form) => (
              <TableRow key={form.id} className="border-border/20 hover:bg-primary/[0.03] transition-all group">
                <TableCell className="px-8">
                  <div className="flex flex-col gap-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-black w-fit uppercase">
                      {form.master_departments?.code || "N/A"}
                    </span>
                    <span className="text-sm font-bold text-foreground/80">
                      {form.master_departments?.name || "Tanpa Departemen"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-2xl">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-extrabold text-sm truncate max-w-[250px]">{form.nama_form}</span>
                      <span className="text-[11px] font-mono text-muted-foreground uppercase">{form.nomor_form}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent border border-border flex items-center justify-center italic font-black text-[10px]">
                      {form.profiles?.full_name?.charAt(0) || "P"}
                    </div>
                    <span className="text-sm font-black">
                      {form.profiles?.full_name || "Belum Ditentukan"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right px-8">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-blue-500/10 group/btn" asChild title="Buka Excel">
                      <a href={form.link_form} target="_blank" rel="noreferrer">
                        <ExternalLink className="w-4 h-4 text-blue-500 group-hover/btn:scale-110 transition-transform" />
                      </a>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-amber-500/10" onClick={() => handleOpenModal(form)}>
                      <Pencil className="w-4 h-4 text-amber-500" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-destructive/10" onClick={() => handleDelete(form.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl glass-card border-border/30 shadow-elevated rounded-[2.5rem] p-8 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tighter uppercase italic">
               {selectedForm ? "Konfigurasi Template" : "Registrasi Template Baru"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-6 py-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Upload File Template (.xlsx)</Label>
              <div 
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={cn(
                  "relative group cursor-pointer border-2 border-dashed border-border/50 rounded-[2rem] p-8 transition-all flex flex-col items-center justify-center gap-3 overflow-hidden",
                  formData.link_form ? "border-emerald-500/30 bg-emerald-500/[0.02]" : "hover:border-primary/50 hover:bg-primary/[0.02]",
                  isUploading && "cursor-not-allowed opacity-80"
                )}
              >
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx,.xls" disabled={isUploading} />
                
                {/* Progress Bar Overlay */}
                {isUploading && (
                    <div className="absolute bottom-0 left-0 h-1 bg-primary/20 w-full">
                        <div 
                            className="h-full bg-primary transition-all duration-300 ease-out" 
                            style={{ width: `${uploadProgress}%` }}
                        />
                    </div>
                )}

                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <span className="text-[10px] font-bold text-primary">{uploadProgress}%</span>
                  </div>
                ) : formData.link_form ? (
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 animate-in zoom-in" />
                ) : (
                  <Upload className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors" />
                )}

                <div className="text-center">
                  <p className="text-sm font-black uppercase italic tracking-tighter">
                    {isUploading ? "Mengunggah..." : formData.link_form ? "File Siap Digunakan" : "Klik untuk Pilih File Excel"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                    {formData.link_form ? "Nama form telah terisi otomatis" : "Link & Nama akan terisi otomatis"}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 text-emerald-500">Departemen</Label>
                <Select value={formData.department_id} onValueChange={(v) => setFormData({...formData, department_id: v})}>
                  <SelectTrigger className="bg-background/40 border-border/50 rounded-2xl h-12 focus:ring-emerald-500/50">
                    <SelectValue placeholder="Pilih Dept" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/50 shadow-2xl">
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id} className="rounded-lg">{d.code} - {d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 text-emerald-500">PIC Executor</Label>
                <Select value={formData.pic_id} onValueChange={(v) => setFormData({...formData, pic_id: v})}>
                  <SelectTrigger className="bg-background/40 border-border/50 rounded-2xl h-12 focus:ring-emerald-500/50">
                    <SelectValue placeholder="Pilih User" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/50 shadow-2xl">
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id} className="rounded-lg">{u.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nama Form Resmi</Label>
              <Input 
                value={formData.nama_form} 
                onChange={(e) => setFormData({...formData, nama_form: e.target.value})} 
                placeholder="Misal: Form Pengajuan Dana (PGD)"
                className="bg-background/40 border-border/50 rounded-2xl h-12 font-bold focus:ring-primary/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Kode Form</Label>
                    <Input 
                        value={formData.nomor_form} 
                        onChange={(e) => setFormData({...formData, nomor_form: e.target.value})} 
                        placeholder="MBN-FIN-01"
                        className="bg-background/40 border-border/50 rounded-2xl h-12 font-mono text-[11px]"
                    />
                </div>
                <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 opacity-50 italic">URL Link (Read-Only)</Label>
                    <Input 
                        value={formData.link_form} 
                        readOnly
                        placeholder="Auto-filled via Upload"
                        className="bg-muted/30 border-border/30 rounded-2xl h-12 text-[10px] text-emerald-500 font-mono"
                    />
                </div>
            </div>
          </div>

          <DialogFooter className="gap-3 pt-4 border-t border-border/20">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-2xl h-12 px-8 font-black text-xs uppercase">Batal</Button>
            <Button 
                onClick={handleSave} 
                disabled={loading || isUploading} 
                className="rounded-2xl h-12 px-10 font-black bg-primary text-primary-foreground hover:glow-effect transition-all flex-1 uppercase text-xs"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Simpan Konfigurasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}