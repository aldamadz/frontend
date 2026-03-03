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
  Plus, Pencil, Loader2, Settings2, X, Database, 
  Trash2, ChevronRight, Layers, Building2, Globe
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TTDConfig {
  roleName: string; 
  labelJabatan: string; 
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
  const [activeFilter, setActiveFilter] = useState<'all' | 'pusat' | 'cabang'>('all');

  const [formData, setFormData] = useState({
    membuat: "",
    memeriksa: "",
    menyetujui: "",
    form_id: "",
    is_cabang: false,
    ttd_config: [] as TTDConfig[]
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: formsData } = await supabase.from("master_forms").select("id, nama_form");
      setMasterForms(formsData || []);

      const { data: workflowData, error } = await supabase
        .from("master_penggunaan_detail")
        .select(`*, master_forms!master_penggunaan_detail_form_id_fkey (nama_form)`)
        .order("created_at", { ascending: false }); // Menggunakan created_at sebagai ganti level

      if (error) throw error;
      setDetails(workflowData || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const filteredDetails = details.filter(item => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'cabang') return item.is_cabang === true;
    return item.is_cabang === false || item.is_cabang === null;
  });

  const cleanCommaInput = (val: string) => val.split(',').map(s => s.trim()).filter(s => s !== "").join(', ');

  const handleOpenModal = (item: any = null) => {
    if (item) {
      setSelectedItem(item);
      setFormData({ 
        membuat: item.membuat || "",
        memeriksa: item.memeriksa || "",
        menyetujui: item.menyetujui || "",
        form_id: item.form_id || "",
        is_cabang: item.is_cabang || false,
        ttd_config: Array.isArray(item.ttd_config) ? item.ttd_config : [] 
      });
    } else {
      setSelectedItem(null);
      setFormData({
        membuat: "", memeriksa: "", menyetujui: "",
        form_id: masterForms[0]?.id || "",
        is_cabang: false,
        ttd_config: []
      });
    }
    setIsModalOpen(true);
  };

  const addTTDMapping = (roleKey: string, labelInput: string) => {
    if (!labelInput) return;
    const labels = labelInput.split(',').map(s => s.trim()).filter(s => s !== "");
    const newConfigs = labels.map(label => ({
      roleName: roleKey, labelJabatan: label, ttd: "", nama: "", jabatan: "", sheet: 1
    }));
    const uniqueConfigs = newConfigs.filter(n => !formData.ttd_config.some(e => e.roleName === n.roleName && e.labelJabatan === n.labelJabatan));
    setFormData({ ...formData, ttd_config: [...formData.ttd_config, ...uniqueConfigs] });
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const payload = {
        membuat: cleanCommaInput(formData.membuat),
        memeriksa: cleanCommaInput(formData.memeriksa),
        menyetujui: cleanCommaInput(formData.menyetujui),
        form_id: formData.form_id,
        is_cabang: formData.is_cabang,
        ttd_config: formData.ttd_config
      };
      
      const { error } = selectedItem 
        ? await supabase.from("master_penggunaan_detail").update(payload).eq("id", selectedItem.id)
        : await supabase.from("master_penggunaan_detail").insert([payload]);

      if (error) throw error;
      toast({ title: "Success", description: "Workflow configuration saved." });
      setIsModalOpen(false);
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally { setLoading(false); }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-screen space-y-8">
      {/* Header Section */}
      <div className="flex justify-between items-center border-b border-border pb-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3 text-gradient uppercase">
            <Layers className="text-primary h-6 w-6"/> Stamp Engine v4.0
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex bg-muted rounded-lg p-1 border border-border">
              {(['all', 'pusat', 'cabang'] as const).map((f) => (
                <button 
                  key={f} 
                  onClick={() => setActiveFilter(f)} 
                  className={`px-4 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${activeFilter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
        <Button onClick={() => handleOpenModal()} className="font-bold px-6 h-11 glow-effect">
          <Plus className="mr-2 h-4 w-4"/> NEW MATRIX
        </Button>
      </div>

      {/* Table Section */}
      <div className="elevated-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="w-32 text-center font-bold text-xs">SCOPE</TableHead>
              <TableHead className="font-bold text-xs uppercase">Workflow Sequence</TableHead>
              <TableHead className="font-bold text-xs uppercase">Coordinate Matrix Mapping</TableHead>
              <TableHead className="text-right px-8 font-bold text-xs uppercase">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && details.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-48 text-center">
                  <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : filteredDetails.map((item) => (
              <TableRow key={item.id} className="border-b border-border/50 transition-colors hover:bg-muted/10">
                <TableCell className="text-center">
                  <Badge className={`px-3 py-1 text-[10px] font-bold ${item.is_cabang ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                    {item.is_cabang ? 'CABANG' : 'PUSAT'}
                  </Badge>
                </TableCell>
                <TableCell className="py-6">
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <Badge variant="secondary" className="text-[10px] font-bold uppercase border-l-2 border-l-green-500">M: {item.membuat}</Badge>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <Badge variant="secondary" className="text-[10px] font-bold uppercase border-l-2 border-l-yellow-500">C: {item.memeriksa}</Badge>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <Badge variant="secondary" className="text-[10px] font-bold uppercase border-l-2 border-l-red-500">A: {item.menyetujui}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <Database className="h-3 w-3" /> {item.master_forms?.nama_form}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {item.ttd_config?.map((t: any, i: number) => (
                      <div key={i} className="bg-muted border border-border p-2 rounded text-[10px] min-w-[100px]">
                        <p className="font-extrabold text-primary uppercase leading-tight">{t.roleName}</p>
                        <p className="font-medium text-foreground truncate">{t.labelJabatan}</p>
                        <p className="font-mono text-warning mt-1">{t.ttd || 'N/A'}</p>
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right px-8 space-x-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenModal(item)}>
                    <Pencil className="h-3.5 w-3.5"/>
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8 text-destructive border-destructive/20 hover:bg-destructive/10" onClick={() => {
                    if(confirm("Confirm delete?")) supabase.from("master_penggunaan_detail").delete().eq("id", item.id).then(() => loadData());
                  }}>
                    <Trash2 className="h-3.5 w-3.5"/>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Modal Section */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-7xl h-[90vh] flex flex-col p-0 overflow-hidden glass-card border-border shadow-elevated">
          <DialogHeader className="p-6 border-b border-border bg-card">
            <DialogTitle className="flex items-center gap-2 text-xl font-extrabold uppercase tracking-tight">
              <Settings2 className="text-primary h-5 w-5"/> Workflow Configuration
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden grid grid-cols-12">
            {/* Sidebar Form */}
            <div className="col-span-4 p-6 border-r border-border overflow-y-auto space-y-6 bg-muted/20">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Form Template Target</Label>
                  <select 
                    className="w-full bg-background border border-input rounded-lg h-10 px-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all" 
                    value={formData.form_id} 
                    onChange={(e) => setFormData({...formData, form_id: e.target.value})}
                  >
                    {masterForms.map(f => <option key={f.id} value={f.id}>{f.nama_form}</option>)}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Entity Scope</Label>
                  <Button 
                    variant="outline" 
                    className={`w-full font-bold h-10 text-[10px] ${formData.is_cabang ? 'border-orange-500/50 text-orange-500' : 'border-blue-500/50 text-blue-500'}`} 
                    onClick={() => setFormData({...formData, is_cabang: !formData.is_cabang})}
                  >
                    {formData.is_cabang ? <Building2 className="mr-2 h-3 w-3"/> : <Globe className="mr-2 h-3 w-3"/>}
                    {formData.is_cabang ? 'OPERASIONAL CABANG' : 'KANTOR PUSAT'}
                  </Button>
                </div>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <p className="text-[10px] font-black text-muted-foreground uppercase mb-2 italic">* Input jobs separated by comma</p>
                {(['membuat', 'memeriksa', 'menyetujui'] as const).map((key) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">{key}</Label>
                    <div className="flex gap-2">
                      <Input className="text-xs h-9" placeholder="Example: Manager, Direktur..." value={formData[key]} onChange={(e) => setFormData({...formData, [key]: e.target.value})} />
                      <Button size="icon" className="h-9 w-9 shrink-0" onClick={() => addTTDMapping(key, formData[key])}>
                        <Plus className="h-4 w-4"/>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Matrix Board */}
            <div className="col-span-8 p-8 overflow-y-auto bg-background/50 custom-scrollbar">
              <h3 className="text-xs font-bold mb-6 flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                <Database className="h-4 w-4 text-primary"/> Coordinate Matrix Mapping
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {formData.ttd_config.length === 0 && (
                  <div className="h-40 border-2 border-dashed border-border rounded-xl flex items-center justify-center text-muted-foreground text-xs font-medium">
                    No mappings generated. Click the "+" button on the sidebar to start.
                  </div>
                )}
                {formData.ttd_config.map((t, i) => (
                  <div key={i} className="elevated-card rounded-lg p-5 grid grid-cols-12 gap-4 items-end relative group border border-border/50">
                    <div className="col-span-3">
                      <p className="text-[9px] font-extrabold text-primary uppercase tracking-tighter mb-1">{t.roleName}</p>
                      <p className="text-xs font-bold truncate text-foreground">{t.labelJabatan}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-[8px] font-bold uppercase text-muted-foreground">TTD Cell</Label>
                      <Input className="h-8 text-[10px] font-mono mt-1 uppercase" placeholder="e.g. C20" value={t.ttd} onChange={(e) => {
                        const nc = [...formData.ttd_config]; nc[i].ttd = e.target.value; setFormData({...formData, ttd_config: nc});
                      }} />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-[8px] font-bold uppercase text-muted-foreground">Name Cell</Label>
                      <Input className="h-8 text-[10px] font-mono mt-1 uppercase" placeholder="e.g. C25" value={t.nama} onChange={(e) => {
                        const nc = [...formData.ttd_config]; nc[i].nama = e.target.value; setFormData({...formData, ttd_config: nc});
                      }} />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-[8px] font-bold uppercase text-muted-foreground">Job Cell</Label>
                      <Input className="h-8 text-[10px] font-mono mt-1 uppercase" placeholder="e.g. C26" value={t.jabatan} onChange={(e) => {
                        const nc = [...formData.ttd_config]; nc[i].jabatan = e.target.value; setFormData({...formData, ttd_config: nc});
                      }} />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-[8px] font-bold uppercase text-muted-foreground">Sheet Index</Label>
                      <Input type="number" className="h-8 text-[10px] mt-1" value={t.sheet} onChange={(e) => {
                        const nc = [...formData.ttd_config]; nc[i].sheet = parseInt(e.target.value); setFormData({...formData, ttd_config: nc});
                      }} />
                    </div>
                    <div className="col-span-1 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setFormData({...formData, ttd_config: formData.ttd_config.filter((_, idx) => idx !== i)})}>
                        <X className="h-4 w-4"/>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 border-t border-border bg-card">
            <Button variant="ghost" className="font-bold text-xs" onClick={() => setIsModalOpen(false)}>CANCEL</Button>
            <Button onClick={handleSave} disabled={loading} className="px-8 font-extrabold text-xs glow-effect">
              {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : 'SAVE WORKFLOW MATRIX'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}