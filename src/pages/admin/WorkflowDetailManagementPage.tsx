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
  Settings2, X, Database, Trash2
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

  // Helper untuk membersihkan input teks dengan koma
  const cleanCommaInput = (val: string) => {
    return val.split(',').map(s => s.trim()).filter(s => s !== "").join(', ');
  };

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

  const addTTDMapping = (labelInput: string) => {
    if (!labelInput) {
      toast({ variant: "destructive", title: "Peringatan", description: "Isi nama jabatan terlebih dahulu" });
      return;
    }

    // Split jika ada koma (mendukung input banyak orang sekaligus)
    const labels = labelInput.split(',').map(s => s.trim()).filter(s => s !== "");
    
    const newConfigs = labels.map(label => ({
      labelJabatan: label,
      roleName: label,
      ttd: "",
      nama: "",
      jabatan: "",
      sheet: 1
    }));

    // Cek duplikasi agar tidak double mapping
    const filteredNewConfigs = newConfigs.filter(
      newCfg => !formData.ttd_config.some(existing => existing.labelJabatan === newCfg.labelJabatan)
    );

    setFormData({
      ...formData,
      ttd_config: [...formData.ttd_config, ...filteredNewConfigs]
    });
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      // Bersihkan format teks sebelum simpan (Pastikan format "Nama, Nama")
      const payload = {
        penggunaan: formData.penggunaan,
        status_level: parseInt(formData.status_level),
        membuat: cleanCommaInput(formData.membuat),
        memeriksa: cleanCommaInput(formData.memeriksa),
        menyetujui: cleanCommaInput(formData.menyetujui),
        lampiran_wajib: formData.lampiran_wajib,
        form_id: formData.form_id,
        ttd_config: formData.ttd_config
      };

      const { error } = selectedItem 
        ? await supabase.from("master_penggunaan_detail").update(payload).eq("id", selectedItem.id)
        : await supabase.from("master_penggunaan_detail").insert([payload]);

      if (error) throw error;

      toast({ title: "Berhasil", description: "Matriks stamp digital telah diperbarui" });
      setIsModalOpen(false);
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    } finally { setLoading(false); }
  };

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto min-h-screen bg-background text-foreground">
      {/* HEADER */}
      <div className="flex justify-between items-center border-b pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
            <GitMerge className="text-primary h-6 w-6"/> STAMP DIGITAL ENGINE
          </h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Workflow & Coordinate Mapping</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="font-bold shadow-sm">
            <Plus className="mr-2 h-4 w-4"/> TAMBAH MATRIKS
        </Button>
      </div>

      {/* TABLE */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-16 text-center font-bold">LVL</TableHead>
              <TableHead className="font-bold">DETAIL PENGGUNAAN</TableHead>
              <TableHead className="font-bold">MAPPING ROLES</TableHead>
              <TableHead className="text-right font-bold px-6">AKSI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && details.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                        <Loader2 className="animate-spin inline mr-2 h-4 w-4" /> Sinkronisasi data...
                    </TableCell>
                </TableRow>
            ) : details.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="text-center font-bold text-primary">{item.status_level}</TableCell>
                <TableCell>
                  <div className="font-bold">{item.penggunaan}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                    <Database className="h-3 w-3" /> {item.master_forms?.nama_form || 'No Form'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {item.ttd_config?.map((t: any, i: number) => (
                      <Badge key={i} variant="outline" className="text-[9px] font-semibold py-0">
                        {t.labelJabatan} → {t.ttd}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right px-6">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenModal(item)}>
                        <Pencil className="h-4 w-4 text-muted-foreground"/>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => {
                        if(confirm("Hapus matriks ini?")) {
                          supabase.from("master_penggunaan_detail").delete().eq("id", item.id).then(() => loadData());
                        }
                    }}>
                        <Trash2 className="h-4 w-4"/>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-7xl p-0 h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="p-6 border-b bg-muted/20">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <Settings2 className="text-primary h-5 w-5"/> CONFIGURATION BOX
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden grid grid-cols-12">
            {/* LEFT: INFO */}
            <div className="col-span-4 p-6 border-r overflow-y-auto space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Form Template</Label>
                  <select 
                    className="w-full bg-background border rounded-md p-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    value={formData.form_id}
                    onChange={(e) => setFormData({...formData, form_id: e.target.value})}
                  >
                    {masterForms.map(form => (
                        <option key={form.id} value={form.id}>{form.nama_form}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Tujuan Penggunaan</Label>
                  <Input value={formData.penggunaan} onChange={(e) => setFormData({...formData, penggunaan: e.target.value})} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Status Level</Label>
                    <Input type="number" value={formData.status_level} onChange={(e) => setFormData({...formData, status_level: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Lampiran Wajib</Label>
                    <Input placeholder="Contoh: PDF" value={formData.lampiran_wajib} onChange={(e) => setFormData({...formData, lampiran_wajib: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-muted/30 rounded-lg space-y-4 border border-dashed">
                <Label className="text-[10px] font-black uppercase text-primary">Input Jabatan (Pisahkan dengan koma)</Label>
                {['membuat', 'memeriksa', 'menyetujui'].map((key) => (
                  <div key={key} className="flex gap-2 items-center">
                    <Input 
                        placeholder={key.toUpperCase()} 
                        className="h-8 text-xs"
                        value={(formData as any)[key]} 
                        onChange={(e) => setFormData({...formData, [key]: e.target.value})} 
                    />
                    <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => addTTDMapping((formData as any)[key])}>
                        <Plus className="h-3 w-3"/>
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT: MAPPING */}
            <div className="col-span-8 p-6 bg-muted/10 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-sm uppercase">Excel Coordinate Mapping</h3>
                <Badge variant="secondary">{formData.ttd_config.length} Jabatan Terdaftar</Badge>
              </div>

              <div className="space-y-2">
                {formData.ttd_config.map((t, i) => (
                  <div key={i} className="bg-background border rounded-md p-3 grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-3">
                      <p className="text-[10px] font-bold text-primary truncate">{t.labelJabatan}</p>
                    </div>
                    <div className="col-span-2">
                      <Input className="h-7 text-[10px] text-center uppercase" placeholder="TTD" value={t.ttd} onChange={(e) => {
                          const newC = [...formData.ttd_config]; newC[i].ttd = e.target.value; setFormData({...formData, ttd_config: newC});
                      }} />
                    </div>
                    <div className="col-span-2">
                      <Input className="h-7 text-[10px] text-center uppercase" placeholder="NAMA" value={t.nama} onChange={(e) => {
                          const newC = [...formData.ttd_config]; newC[i].nama = e.target.value; setFormData({...formData, ttd_config: newC});
                      }} />
                    </div>
                    <div className="col-span-2">
                      <Input className="h-7 text-[10px] text-center uppercase" placeholder="JABATAN" value={t.jabatan} onChange={(e) => {
                          const newC = [...formData.ttd_config]; newC[i].jabatan = e.target.value; setFormData({...formData, ttd_config: newC});
                      }} />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" className="h-7 text-[10px] text-center" value={t.sheet} onChange={(e) => {
                          const newC = [...formData.ttd_config]; newC[i].sheet = parseInt(e.target.value); setFormData({...formData, ttd_config: newC});
                      }} />
                    </div>
                    <div className="col-span-1 text-right">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => {
                          setFormData({...formData, ttd_config: formData.ttd_config.filter((_, idx) => idx !== i)});
                      }}><X className="h-3 w-3"/></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-background">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>BATAL</Button>
            <Button onClick={handleSave} disabled={loading} className="font-bold">
                {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : 'SIMPAN MATRIKS'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}