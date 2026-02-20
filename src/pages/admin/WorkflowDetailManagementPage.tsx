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
import { Badge } from "@/components/ui/badge";
import { 
  GitMerge, Plus, Pencil, Loader2, 
  Settings2, X, ChevronRight, Database, Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TTDConfig {
  labelJabatan: string; 
  roleName: string;     
  ttd: string;          
  nama: string;         
  jabatan: string;      
  sheet: number;
}

export default function WorkflowDetailManagementPage() {
  const { toast } = useToast();
  const [details, setDetails] = useState<any[]>([]);
  const [masterForms, setMasterForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const [formData, setFormData] = useState({
    penggunaan: "",
    status_level: "1",
    membuat: "",
    memeriksa: "",
    menyetujui: "",
    lampiran_wajib: "",
    form_id: "",
    ttd_config: [] as TTDConfig[]
  });

  const loadData = async () => {
    try {
      setLoading(true);
      // Load Master Forms untuk dropdown
      const { data: formsData } = await supabase.from("master_forms").select("id, nama_form, nomor_form");
      setMasterForms(formsData || []);

      const { data: workflowData, error } = await supabase
        .from("master_penggunaan_detail")
        .select(`*, master_forms!master_penggunaan_detail_form_id_fkey (nama_form, nomor_form)`)
        .order("penggunaan", { ascending: true });

      if (error) throw error;
      setDetails(workflowData || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleOpenModal = (item: any = null) => {
    if (item) {
      setSelectedItem(item);
      setFormData({ 
        penggunaan: item.penggunaan || "",
        status_level: item.status_level?.toString() || "1",
        membuat: item.membuat || "",
        memeriksa: item.memeriksa || "",
        menyetujui: item.menyetujui || "",
        lampiran_wajib: item.lampiran_wajib || "",
        form_id: item.form_id || "",
        ttd_config: Array.isArray(item.ttd_config) ? item.ttd_config : [] 
      });
    } else {
      setSelectedItem(null);
      setFormData({
        penggunaan: "", status_level: "1", membuat: "", memeriksa: "", menyetujui: "",
        lampiran_wajib: "", form_id: masterForms[0]?.id || "",
        ttd_config: []
      });
    }
    setIsModalOpen(true);
  };

  const addTTDMapping = (label: string) => {
    if (!label) {
      toast({ variant: "destructive", title: "Peringatan", description: "Isi nama jabatan terlebih dahulu" });
      return;
    }
    setFormData({
      ...formData,
      ttd_config: [
        ...formData.ttd_config, 
        { labelJabatan: label, roleName: label, ttd: "", nama: "", jabatan: "", sheet: 1 }
      ]
    });
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const payload = {
        penggunaan: formData.penggunaan,
        status_level: parseInt(formData.status_level),
        membuat: formData.membuat,
        memeriksa: formData.memeriksa,
        menyetujui: formData.menyetujui,
        lampiran_wajib: formData.lampiran_wajib,
        form_id: formData.form_id,
        ttd_config: formData.ttd_config
      };

      const { error } = selectedItem 
        ? await supabase.from("master_penggunaan_detail").update(payload).eq("id", selectedItem.id)
        : await supabase.from("master_penggunaan_detail").insert([payload]);

      if (error) throw error;

      toast({ title: "Berhasil", description: "Konfigurasi workflow telah disimpan" });
      setIsModalOpen(false);
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal Menyimpan", description: error.message });
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus matriks ini?")) return;
    
    try {
      setLoading(true);
      const { error } = await supabase.from("master_penggunaan_detail").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Terhapus", description: "Matriks berhasil dihapus" });
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal Menghapus", description: error.message });
    } finally { setLoading(false); }
  };

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto min-h-screen">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-end border-b border-border/50 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
                <GitMerge className="text-primary h-8 w-8"/>
            </div>
            MATRIKS WORKFLOW
          </h1>
          <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Database Mapping Engine</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="font-bold bg-primary hover:bg-primary/90 glow-effect px-6">
            <Plus className="mr-2 h-5 w-5"/> TAMBAH MATRIKS
        </Button>
      </div>

      {/* TABLE SECTION */}
      <div className="elevated-card rounded-xl overflow-hidden bg-card border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border">
              <TableHead className="w-16 text-center font-bold text-foreground">LVL</TableHead>
              <TableHead className="font-bold text-foreground">DETAIL PENGGUNAAN</TableHead>
              <TableHead className="font-bold text-foreground">EXCEL MAPPING CONFIG</TableHead>
              <TableHead className="text-right font-bold text-foreground px-6">OPSI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && details.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground font-medium">
                        <Loader2 className="animate-spin inline mr-2 h-5 w-5" /> Memuat data...
                    </TableCell>
                </TableRow>
            ) : details.map((item) => (
              <TableRow key={item.id} className="hover:bg-accent/30 transition-colors group">
                <TableCell className="text-center font-black text-primary text-lg">{item.status_level}</TableCell>
                <TableCell>
                  <div className="font-bold text-foreground group-hover:text-primary transition-colors">{item.penggunaan}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Database className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                        {item.master_forms?.nama_form || 'No Form Linked'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {item.ttd_config?.map((t: any, i: number) => (
                      <Badge key={i} variant="secondary" className="bg-secondary/50 text-[10px] py-1 border-border/50 font-medium">
                        <span className="text-primary mr-1">{t.labelJabatan}:</span> {t.ttd}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right px-6">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="hover:bg-primary hover:text-white transition-all" onClick={() => handleOpenModal(item)}>
                        <Pencil className="h-4 w-4"/>
                    </Button>
                    <Button variant="ghost" size="icon" className="hover:bg-destructive hover:text-white transition-all" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4"/>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* MODAL CONFIGURATION */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-7xl p-0 h-[90vh] flex flex-col glass-card border-border/50 overflow-hidden bg-background">
          <DialogHeader className="p-6 border-b border-border bg-card/50">
            <DialogTitle className="flex items-center gap-3 text-xl font-black uppercase">
                <Settings2 className="text-primary h-6 w-6"/> KONFIGURASI STAMP
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden grid grid-cols-12">
            {/* PANEL KIRI */}
            <div className="col-span-4 p-8 border-r border-border overflow-y-auto space-y-6 bg-card/20">
              
              {/* SELECT TEMPLATE FORM */}
              <div className="space-y-3">
                <Label className="font-bold text-xs uppercase text-primary">Template Form Utama</Label>
                <select 
                    className="w-full bg-background border border-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary outline-none appearance-none cursor-pointer"
                    value={formData.form_id}
                    onChange={(e) => setFormData({...formData, form_id: e.target.value})}
                >
                    <option value="" disabled>Pilih Template Form</option>
                    {masterForms.map(form => (
                        <option key={form.id} value={form.id}>{form.nama_form} ({form.nomor_form})</option>
                    ))}
                </select>
              </div>

              <div className="space-y-3">
                <Label className="font-bold text-xs uppercase text-primary">Tujuan Penggunaan</Label>
                <textarea 
                    className="w-full bg-background border border-border rounded-xl p-3 text-sm min-h-[80px] outline-none focus:ring-2 focus:ring-primary" 
                    value={formData.penggunaan} 
                    onChange={(e) => setFormData({...formData, penggunaan: e.target.value})} 
                    placeholder="Contoh: Pengajuan Biaya Operasional"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase">Level</Label>
                    <Input type="number" className="rounded-lg" value={formData.status_level} onChange={(e) => setFormData({...formData, status_level: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase">Lampiran</Label>
                    <Input className="rounded-lg" placeholder="PDF/JPG" value={formData.lampiran_wajib} onChange={(e) => setFormData({...formData, lampiran_wajib: e.target.value})} />
                </div>
              </div>

              <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10 space-y-4">
                <Label className="text-xs font-black text-primary uppercase tracking-tighter">Tambah Jabatan Ke Mapping</Label>
                {['membuat', 'memeriksa', 'menyetujui'].map((key) => (
                  <div key={key} className="flex gap-2 items-center group">
                    <Input 
                        placeholder={key.toUpperCase()} 
                        className="bg-background"
                        value={(formData as any)[key]} 
                        onChange={(e) => setFormData({...formData, [key]: e.target.value})} 
                    />
                    <Button size="icon" variant="secondary" className="shrink-0 hover:bg-primary hover:text-white" onClick={() => addTTDMapping((formData as any)[key])}>
                        <Plus className="h-4 w-4"/>
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* PANEL KANAN */}
            <div className="col-span-8 p-8 bg-secondary/5 overflow-y-auto space-y-6 custom-scrollbar">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-xl uppercase tracking-tight">Excel Coordinate Mapping</h3>
                <Badge className="bg-primary px-4 py-1">{formData.ttd_config.length} POSISI</Badge>
              </div>

              <div className="grid gap-3">
                {formData.ttd_config.length === 0 && (
                    <div className="text-center py-20 border-2 border-dashed border-border rounded-3xl opacity-50">
                        <Database className="mx-auto h-12 w-12 mb-3" />
                        <p className="font-medium text-sm">Belum ada mapping koordinat jabatan.</p>
                    </div>
                )}
                {formData.ttd_config.map((t, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4 grid grid-cols-12 gap-3 items-end group hover:border-primary/40 transition-all">
                    <div className="col-span-3 space-y-1">
                      <Label className="text-[10px] uppercase font-black text-muted-foreground">Jabatan</Label>
                      <Input className="h-9 text-xs bg-muted/30 border-none font-bold" value={t.labelJabatan} readOnly />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px] uppercase font-black text-primary">Cell TTD</Label>
                      <Input className="h-9 text-xs text-center font-bold" placeholder="B35" value={t.ttd} onChange={(e) => {
                          const newC = [...formData.ttd_config]; newC[i].ttd = e.target.value.toUpperCase(); setFormData({...formData, ttd_config: newC});
                      }} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px] uppercase font-black text-success">Cell Nama</Label>
                      <Input className="h-9 text-xs text-center font-bold" placeholder="B37" value={t.nama} onChange={(e) => {
                          const newC = [...formData.ttd_config]; newC[i].nama = e.target.value.toUpperCase(); setFormData({...formData, ttd_config: newC});
                      }} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px] uppercase font-black text-warning">Cell Jbtn</Label>
                      <Input className="h-9 text-xs text-center font-bold" placeholder="B34" value={t.jabatan} onChange={(e) => {
                          const newC = [...formData.ttd_config]; newC[i].jabatan = e.target.value.toUpperCase(); setFormData({...formData, ttd_config: newC});
                      }} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px] uppercase font-black">Sheet</Label>
                      <Input type="number" className="h-9 text-xs text-center" value={t.sheet} onChange={(e) => {
                          const newC = [...formData.ttd_config]; newC[i].sheet = parseInt(e.target.value); setFormData({...formData, ttd_config: newC});
                      }} />
                    </div>
                    <div className="col-span-1">
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => {
                          setFormData({...formData, ttd_config: formData.ttd_config.filter((_, idx) => idx !== i)});
                      }}><X className="h-4 w-4"/></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 border-t border-border bg-muted/20">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="font-bold px-8">BATAL</Button>
            <Button onClick={handleSave} disabled={loading} className="px-12 font-black bg-primary glow-effect">
                {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : 'SIMPAN KONFIGURASI'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}