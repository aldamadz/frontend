import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  FileText, Plus, Pencil, Trash2, Loader2, 
  ExternalLink, Search, RefreshCw, FileSpreadsheet 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function FormManagementPage() {
  const { toast } = useToast();
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    nama_form: "",
    nomor_form: "",
    dept: "",
    link_form: "",
    department_id: ""
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("master_forms")
        .select("*")
        .order("dept", { ascending: true });

      if (error) throw error;
      setForms(data || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat data form" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = (form: any = null) => {
    if (form) {
      setSelectedForm(form);
      setFormData({ ...form });
    } else {
      setSelectedForm(null);
      setFormData({ 
        nama_form: "", 
        nomor_form: "", 
        dept: "", 
        link_form: "", 
        department_id: "" 
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      if (selectedForm) {
        const { error } = await supabase
          .from("master_forms")
          .update(formData)
          .eq("id", selectedForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("master_forms")
          .insert([formData]);
        if (error) throw error;
      }
      toast({ title: "Berhasil", description: "Data form berhasil disimpan" });
      setIsModalOpen(false);
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  // FUNGSI HAPUS BARU
  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus template form ini?")) return;
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from("master_forms")
        .delete()
        .eq("id", id);
      
      if (error) throw error;

      toast({ title: "Terhapus", description: "Template form berhasil dihapus" });
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const filteredForms = forms.filter(f => 
    f.nama_form.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.dept.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> Master Template Form
          </h1>
          <p className="text-sm text-muted-foreground">Kelola template dokumen internal perusahaan</p>
        </div>
        <div className="flex gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Cari nama form / dept..." 
              className="pl-8" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={loadData} size="icon">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
          <Button onClick={() => handleOpenModal()} className="gap-2 font-bold text-xs uppercase">
            <Plus className="w-4 h-4" /> Tambah Form
          </Button>
        </div>
      </div>

      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[100px] font-bold">DEPT</TableHead>
              <TableHead className="font-bold">NAMA FORM</TableHead>
              <TableHead className="font-bold">NOMOR FORM</TableHead>
              <TableHead className="text-right font-bold">AKSI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && forms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-20">
                  <Loader2 className="animate-spin mx-auto w-8 h-8 text-primary"/>
                </TableCell>
              </TableRow>
            ) : filteredForms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-20 text-muted-foreground">
                  Tidak ada template form yang ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              filteredForms.map((form) => (
                <TableRow key={form.id} className="hover:bg-muted/30">
                  <TableCell><span className="font-bold text-primary">{form.dept}</span></TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />
                      <span className="truncate max-w-[300px]">{form.nama_form}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{form.nomor_form}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" title="Buka/Download File" asChild>
                      <a href={form.link_form} target="_blank" rel="noreferrer">
                        <ExternalLink className="w-4 h-4 text-blue-600" />
                      </a>
                    </Button>
                    <Button variant="ghost" size="icon" title="Edit Form" onClick={() => handleOpenModal(form)}>
                      <Pencil className="w-4 h-4 text-amber-600" />
                    </Button>
                    {/* TOMBOL HAPUS SEKARANG ADA DI SINI */}
                    <Button variant="ghost" size="icon" title="Hapus Form" onClick={() => handleDelete(form.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedForm ? "Edit" : "Tambah"} Template Form</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kode Dept</Label>
                <Input 
                  value={formData.dept} 
                  onChange={(e) => setFormData({...formData, dept: e.target.value.toUpperCase()})} 
                  placeholder="CONTOH: PGD"
                />
              </div>
              <div className="space-y-2">
                <Label>Nomor Form</Label>
                <Input 
                  value={formData.nomor_form} 
                  onChange={(e) => setFormData({...formData, nomor_form: e.target.value})} 
                  placeholder="FM-MBN..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nama Form</Label>
              <Input 
                value={formData.nama_form} 
                onChange={(e) => setFormData({...formData, nama_form: e.target.value})} 
                placeholder="Masukkan nama dokumen"
              />
            </div>
            <div className="space-y-2">
              <Label>Link/URL Template (Supabase Storage)</Label>
              <Input 
                value={formData.link_form} 
                onChange={(e) => setFormData({...formData, link_form: e.target.value})} 
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={loading} className="min-w-[100px]">
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}