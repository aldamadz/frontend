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
  Briefcase, Plus, Pencil, Trash2, Loader2, 
  Search, RefreshCw, Building2, Fingerprint, Calendar
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function MasterProjectManagementPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    office_id: "",
    entity_id: ""
  });

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load Dropdown Data (Office & Entity)
      const [offRes, entRes] = await Promise.all([
        supabase.from("master_offices").select("id, name"),
        supabase.from("master_entities").select("id, name")
      ]);

      setOffices(offRes.data || []);
      setEntities(entRes.data || []);

      // Load Projects with Joins
      const { data, error } = await supabase
        .from("master_projects")
        .select(`
          *,
          master_offices ( name ),
          master_entities ( name )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal Memuat", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleOpenModal = (item: any = null) => {
    if (item) {
      setSelectedItem(item);
      setFormData({
        name: item.name,
        code: item.code || "",
        office_id: item.office_id,
        entity_id: item.entity_id || ""
      });
    } else {
      setSelectedItem(null);
      setFormData({ name: "", code: "", office_id: offices[0]?.id || "", entity_id: "" });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.office_id) {
      toast({ variant: "destructive", title: "Error", description: "Nama dan Kantor wajib diisi" });
      return;
    }

    try {
      setLoading(true);
      const payload = { 
        ...formData, 
        entity_id: formData.entity_id || null // Handle empty string as null
      };

      const { error } = selectedItem 
        ? await supabase.from("master_projects").update(payload).eq("id", selectedItem.id)
        : await supabase.from("master_projects").insert([payload]);

      if (error) throw error;
      toast({ title: "Berhasil", description: "Data proyek telah disimpan" });
      setIsModalOpen(false);
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal Simpan", description: error.message });
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus proyek ini? Tindakan ini tidak dapat dibatalkan.")) return;
    try {
      setLoading(true);
      const { error } = await supabase.from("master_projects").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Terhapus", description: "Proyek berhasil dihapus" });
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal Hapus", description: error.message });
    } finally { setLoading(false); }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Briefcase className="w-8 h-8 text-primary animate-glow" />
            </div>
            <span className="text-gradient">Master Proyek</span>
          </h1>
          <p className="text-muted-foreground font-medium uppercase tracking-wider text-[11px]">Manajemen Direktori Proyek Seluruh Entitas</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              className="flex h-11 w-full rounded-xl border border-input bg-secondary/50 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 pl-10 transition-all outline-none"
              placeholder="Cari nama atau kode proyek..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={() => handleOpenModal()} className="h-11 px-6 rounded-xl font-bold bg-primary hover:opacity-90 shadow-glow transition-all">
            <Plus className="w-4 h-4 mr-2" /> TAMBAH PROYEK
          </Button>
        </div>
      </div>

      {/* Tabel */}
      <div className="elevated-card rounded-2xl overflow-hidden glass-card">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-b border-border/50">
              <TableHead className="font-extrabold text-[10px] tracking-widest text-muted-foreground uppercase pl-6">Kode</TableHead>
              <TableHead className="w-[400px] font-extrabold text-[10px] tracking-widest text-muted-foreground uppercase">Nama Proyek</TableHead>
              <TableHead className="font-extrabold text-[10px] tracking-widest text-muted-foreground uppercase">Kantor & Entitas</TableHead>
              <TableHead className="font-extrabold text-[10px] tracking-widest text-muted-foreground uppercase">Dibuat Pada</TableHead>
              <TableHead className="text-right font-extrabold text-[10px] tracking-widest text-muted-foreground uppercase pr-8">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-32"><Loader2 className="animate-spin mx-auto w-10 h-10 text-primary"/></TableCell></TableRow>
            ) : filteredProjects.map((item) => (
              <TableRow key={item.id} className="hover:bg-accent/20 border-b border-border/30 transition-colors">
                <TableCell className="pl-6 font-mono text-xs text-primary font-bold">
                  {item.code || "N/A"}
                </TableCell>
                <TableCell>
                  <span className="font-bold text-base block text-foreground tracking-tight">{item.name}</span>
                </TableCell>
                <TableCell>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      {item.master_offices?.name}
                    </div>
                    <div className="inline-flex px-2 py-0.5 rounded bg-muted text-[10px] font-bold text-muted-foreground uppercase border border-border/50">
                      {item.master_entities?.name || "Tanpa Entitas"}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground font-medium">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </TableCell>
                <TableCell className="text-right pr-8">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="icon" className="h-9 w-9 rounded-lg border border-border hover:bg-accent" onClick={() => handleOpenModal(item)}>
                      <Pencil className="w-4 h-4 text-primary" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-9 w-9 rounded-lg border border-border hover:bg-destructive/10 hover:border-destructive/30 group" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="w-4 h-4 text-muted-foreground group-hover:text-destructive transition-colors" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Modal Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl bg-card border-border shadow-2xl p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 bg-muted/30 border-b border-border">
            <DialogTitle className="flex items-center gap-3 text-xl font-extrabold tracking-tight">
              <div className="p-1.5 bg-primary/20 rounded-lg">
                <Briefcase className="w-5 h-5 text-primary" />
              </div>
              {selectedItem ? "Edit Detail Proyek" : "Tambah Proyek Baru"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-8 space-y-6 custom-scrollbar max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Nama Proyek *</Label>
                <Input className="h-12 bg-secondary/30 border-border rounded-xl" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Masukkan nama proyek" />
              </div>
              
              <div className="space-y-2">
                <Label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Kode Proyek</Label>
                <Input className="h-12 bg-secondary/30 border-border rounded-xl font-mono" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} placeholder="PRJ-001" />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Kantor Cabang *</Label>
                <Select value={formData.office_id} onValueChange={(v) => setFormData({...formData, office_id: v})}>
                  <SelectTrigger className="h-12 bg-secondary/30 border-border rounded-xl">
                    <SelectValue placeholder="Pilih Kantor" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {offices.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-2">
                <Label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Entitas / Badan Hukum</Label>
                <Select value={formData.entity_id} onValueChange={(v) => setFormData({...formData, entity_id: v})}>
                  <SelectTrigger className="h-12 bg-secondary/30 border-border rounded-xl">
                    <SelectValue placeholder="Pilih Entitas (Opsional)" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="none">Tanpa Entitas</SelectItem>
                    {entities.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 bg-muted/30 border-t border-border flex gap-3">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="font-bold rounded-xl h-11 px-6">BATAL</Button>
            <Button onClick={handleSave} disabled={loading} className="bg-primary hover:opacity-90 font-bold rounded-xl h-11 px-8 shadow-glow">
              {loading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Fingerprint className="w-4 h-4 mr-2" />}
              SIMPAN DATA PROYEK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}