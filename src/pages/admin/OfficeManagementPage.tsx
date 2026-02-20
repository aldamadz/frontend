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
  MapPin, Plus, Pencil, Trash2, Loader2, 
  Search, RefreshCw 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function OfficeManagementPage() {
  const { toast } = useToast();
  const [offices, setOffices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    code: ""
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("master_offices")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setOffices(data || []);
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: "Gagal memuat data kantor" 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = (office: any = null) => {
    if (office) {
      setSelectedOffice(office);
      setFormData({ name: office.name, code: office.code });
    } else {
      setSelectedOffice(null);
      setFormData({ name: "", code: "" });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code) {
      toast({ variant: "destructive", title: "Peringatan", description: "Nama dan Kode wajib diisi" });
      return;
    }

    try {
      setLoading(true);
      const payload = {
        name: formData.name,
        code: formData.code.toUpperCase()
      };

      if (selectedOffice) {
        const { error } = await supabase
          .from("master_offices")
          .update(payload)
          .eq("id", selectedOffice.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("master_offices")
          .insert([payload]);
        if (error) throw error;
      }

      toast({ title: "Berhasil", description: "Data kantor telah diperbarui" });
      setIsModalOpen(false);
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus kantor ini? Tindakan ini tidak dapat dibatalkan.")) return;
    try {
      setLoading(true);
      const { error } = await supabase.from("master_offices").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Terhapus", description: "Data kantor berhasil dihapus" });
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const filteredOffices = offices.filter(o => 
    o.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    o.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="w-6 h-6 text-primary" /> Master Kantor Cabang
          </h1>
          <p className="text-sm text-muted-foreground">Manajemen lokasi kantor dan kode area</p>
        </div>
        <div className="flex gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Cari kantor atau kode..." 
              className="pl-8" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={loadData} size="icon">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
          <Button onClick={() => handleOpenModal()} className="gap-2 font-bold text-xs uppercase">
            <Plus className="w-4 h-4" /> Tambah Kantor
          </Button>
        </div>
      </div>

      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[150px] font-bold">KODE AREA</TableHead>
              <TableHead className="font-bold">NAMA KANTOR / CABANG</TableHead>
              <TableHead className="text-right font-bold">AKSI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && offices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-20">
                  <Loader2 className="animate-spin mx-auto w-8 h-8 text-primary"/>
                </TableCell>
              </TableRow>
            ) : filteredOffices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-20 text-muted-foreground">
                  Tidak ada data kantor ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              filteredOffices.map((office) => (
                <TableRow key={office.id} className="hover:bg-muted/30">
                  <TableCell>
                    <code className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-bold">
                      {office.code}
                    </code>
                  </TableCell>
                  <TableCell className="font-medium">{office.name}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenModal(office)}>
                      <Pencil className="w-4 h-4 text-amber-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(office.id)}>
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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{selectedOffice ? "Edit" : "Tambah"} Kantor Cabang</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nama Kota/Kantor</Label>
              <Input 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                placeholder="E.g. Magelang"
              />
            </div>
            <div className="space-y-2">
              <Label>Kode Kantor (3-4 Huruf)</Label>
              <Input 
                value={formData.code} 
                onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})} 
                placeholder="E.g. MGG"
                maxLength={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={loading}>
              Simpan Kantor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}