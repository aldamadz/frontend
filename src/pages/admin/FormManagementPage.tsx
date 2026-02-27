import React, { useEffect, useState } from "react";
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
  ExternalLink, Search, RefreshCw, FileSpreadsheet, User
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function FormManagementPage() {
  const { toast } = useToast();
  const [forms, setForms] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
      
      // Menggunakan join eksplisit untuk menghindari error PGRST201
      const { data: formsData, error: formsError } = await supabase
        .from("master_forms")
        .select(`
          *,
          master_departments!department_id (id, name, code),
          profiles!pic_id (id, full_name)
        `)
        .order("created_at", { ascending: false });

      if (formsError) throw formsError;

      // Ambil data pendukung secara paralel untuk performa lebih cepat
      const [deptsRes, usersRes] = await Promise.all([
        supabase.from("master_departments").select("*").order("name"),
        supabase.from("profiles").select("id, full_name").order("full_name")
      ]);

      setForms(formsData || []);
      setDepartments(deptsRes.data || []);
      setUsers(usersRes.data || []);

    } catch (error: any) {
      console.error("Fetch Error:", error);
      toast({ 
        variant: "destructive", 
        title: "Koneksi Bermasalah", 
        description: error.message || "Gagal sinkronisasi dengan database." 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

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
      const { data, error } = selectedForm 
        ? await supabase.from("master_forms").update(formData).eq("id", selectedForm.id)
        : await supabase.from("master_forms").insert([formData]);

      if (error) throw error;
      
      toast({ title: "Berhasil", description: "Data template telah diperbarui." });
      setIsModalOpen(false);
      loadInitialData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal Menyimpan", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus template ini secara permanen?")) return;
    try {
      setLoading(true);
      const { error } = await supabase.from("master_forms").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Dihapus", description: "Template berhasil dihapus dari sistem." });
      loadInitialData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal Menghapus", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const filteredForms = forms.filter(f => 
    f.nama_form?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.master_departments?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.master_departments?.code?.toLowerCase().includes(searchQuery.toLowerCase())
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
              className="pl-10 h-12 bg-card/40 border-border/50 rounded-2xl focus:ring-primary/50" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={loadInitialData} size="icon" className="h-12 w-12 rounded-2xl glass-card">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
          <Button onClick={() => handleOpenModal()} className="h-12 px-6 gap-2 font-black text-xs uppercase rounded-2xl glow-effect">
            <Plus className="w-4 h-4" /> Tambah Form
          </Button>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="glass-card rounded-[2rem] overflow-hidden border-border/20 shadow-2xl">
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
                  <span className="block mt-4 text-[10px] font-black tracking-widest text-muted-foreground uppercase">Sinkronisasi Database...</span>
                </TableCell>
              </TableRow>
            ) : filteredForms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-32 text-muted-foreground font-bold italic opacity-30">
                  Data tidak ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              filteredForms.map((form) => (
                <TableRow key={form.id} className="border-border/20 hover:bg-primary/[0.03] transition-all group">
                  <TableCell className="px-8">
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-black w-fit">
                        {form.master_departments?.code || "N/A"}
                      </span>
                      <span className="text-sm font-bold text-foreground/80 truncate max-w-[150px]">
                        {form.master_departments?.name || "Tanpa Departemen"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-emerald-500/10 rounded-2xl group-hover:bg-emerald-500/20 transition-colors">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="font-extrabold text-sm truncate max-w-[250px]">{form.nama_form}</span>
                        <span className="text-[11px] font-mono text-muted-foreground tracking-tighter uppercase">{form.nomor_form}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent border border-border flex items-center justify-center">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-black text-foreground/90">
                        {form.profiles?.full_name || "Belum Ditentukan"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-8">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-blue-500/10 group/btn" asChild>
                        <a href={form.link_form} target="_blank" rel="noreferrer">
                          <ExternalLink className="w-4 h-4 text-blue-500 group-hover/btn:scale-110 transition-transform" />
                        </a>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-amber-500/10 group/btn" onClick={() => handleOpenModal(form)}>
                        <Pencil className="w-4 h-4 text-amber-500 group-hover/btn:scale-110 transition-transform" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-destructive/10 group/btn" onClick={() => handleDelete(form.id)}>
                        <Trash2 className="w-4 h-4 text-destructive group-hover/btn:scale-110 transition-transform" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* MODAL SECTION */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl glass-card border-border/30 shadow-elevated rounded-[2rem] p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tighter uppercase">
               {selectedForm ? "Edit Template" : "Tambah Template Baru"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-8 py-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Departemen Eksekutor</Label>
                <Select value={formData.department_id} onValueChange={(v) => setFormData({...formData, department_id: v})}>
                  <SelectTrigger className="bg-background/40 border-border/50 rounded-2xl h-12 focus:ring-primary/50 transition-all">
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
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">PIC Penanggung Jawab</Label>
                <Select value={formData.pic_id} onValueChange={(v) => setFormData({...formData, pic_id: v})}>
                  <SelectTrigger className="bg-background/40 border-border/50 rounded-2xl h-12 focus:ring-primary/50 transition-all">
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
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nama Dokumen</Label>
              <Input 
                value={formData.nama_form} 
                onChange={(e) => setFormData({...formData, nama_form: e.target.value})} 
                placeholder="Contoh: Form Permintaan Barang..."
                className="bg-background/40 border-border/50 rounded-2xl h-12 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nomor Form</Label>
                    <Input 
                        value={formData.nomor_form} 
                        onChange={(e) => setFormData({...formData, nomor_form: e.target.value})} 
                        placeholder="FM-MBN..."
                        className="bg-background/40 border-border/50 rounded-2xl h-12 font-mono text-[11px]"
                    />
                </div>
                <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Link Template (Excel)</Label>
                    <Input 
                        value={formData.link_form} 
                        onChange={(e) => setFormData({...formData, link_form: e.target.value})} 
                        placeholder="https://supabase.co/..."
                        className="bg-background/40 border-border/50 rounded-2xl h-12 text-xs text-blue-400"
                    />
                </div>
            </div>
          </div>

          <DialogFooter className="gap-3 pt-4">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-2xl h-12 px-8 font-bold hover:bg-muted">BATAL</Button>
            <Button onClick={handleSave} disabled={loading} className="rounded-2xl h-12 px-10 font-black bg-primary text-primary-foreground hover:glow-effect transition-all flex-1 md:flex-none">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "SIMPAN PERUBAHAN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}