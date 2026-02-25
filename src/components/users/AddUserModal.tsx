// frontend/src/components/users/AddUserModal.tsx
import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { User, Role } from '@/types/agenda';
import { registerNewUser } from '@/services/user.service'; 
import { getDepartments, Department } from '@/services/department.service';
import { getOffices } from '@/services/office.service';
import { Office } from '@/types/office';
import { toast } from 'sonner';
import { UserPlus, Building2, Briefcase, Fingerprint, Mail, Lock, Loader2, ShieldCheck, User as UserIcon } from 'lucide-react';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  allUsers: User[];
}

export const AddUserModal = ({ isOpen, onClose, onSuccess, allUsers }: AddUserModalProps) => {
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    nik: '',
    role: 'user' as Role,
    jobTitle: '',
    departmentId: 'none' as string | number,
    officeId: 'none' as string | number,
    parentId: 'none' as string
  });

  useEffect(() => {
    if (isOpen) {
      const loadData = async () => {
        try {
          const [depts, offs] = await Promise.all([getDepartments(), getOffices()]);
          setDepartments(depts);
          setOffices(offs);
        } catch (error) {
          console.error("Gagal memuat data master:", error);
        }
      };
      
      loadData();
      setFormData({
        email: '', password: '', fullName: '', nik: '',
        role: 'user', jobTitle: '', departmentId: 'none', officeId: 'none', parentId: 'none'
      });
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!formData.email || !formData.fullName || !formData.nik || !formData.password) {
      return toast.error("Email, Password, Nama, dan NIK wajib diisi");
    }

    if (formData.password.length < 6) {
      return toast.error("Password minimal 6 karakter");
    }

    setLoading(true);
    try {
      // Pastikan payload bersih sebelum dikirim ke service
      const payload = {
        ...formData,
        officeId: formData.officeId === "none" ? null : Number(formData.officeId),
        departmentId: formData.departmentId === "none" ? null : Number(formData.departmentId),
        parentId: formData.parentId === "none" ? null : formData.parentId
      };

      await registerNewUser(payload);
      toast.success("User & Akun berhasil dibuat!");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Registration Error:", error);
      toast.error(error.message || "Gagal membuat user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border shadow-2xl p-0 overflow-hidden">
        {/* Header dengan Gradient */}
        <div className="p-6 pb-0">
          <DialogHeader>
            <div className="flex items-center gap-3 text-primary mb-1">
              <div className="p-2 bg-primary/10 rounded-lg">
                <UserPlus className="w-6 h-6" />
              </div>
              <DialogTitle className="text-2xl font-extrabold tracking-tight text-gradient">
                Registrasi Karyawan
              </DialogTitle>
            </div>
            <DialogDescription className="text-muted-foreground font-medium">
              Sistem akan membuat akun login dan profil database secara otomatis.
            </DialogDescription>
          </DialogHeader>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Section: Akun Login (Glass Effect) */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-primary tracking-[0.2em] uppercase px-1">Informasi Kredensial</h4>
            <div className="grid grid-cols-2 gap-4 bg-secondary/30 p-4 rounded-xl border border-border/50 backdrop-blur-sm">
              <div className="space-y-2">
                <Label className="text-xs font-bold flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-muted-foreground"/> Email Kerja</Label>
                <Input 
                  type="email" 
                  placeholder="name@company.com" 
                  className="bg-background border-border focus:ring-primary h-10"
                  value={formData.email} 
                  onChange={(e) => setFormData({...formData, email: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold flex items-center gap-2"><Lock className="w-3.5 h-3.5 text-muted-foreground"/> Password</Label>
                <Input 
                  type="password" 
                  placeholder="••••••••" 
                  className="bg-background border-border focus:ring-primary h-10"
                  value={formData.password} 
                  onChange={(e) => setFormData({...formData, password: e.target.value})} 
                />
              </div>
            </div>
          </div>

          {/* Section: Profil & Organisasi */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-primary tracking-[0.2em] uppercase px-1">Data Organisasi</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Nama Lengkap</Label>
                <Input 
                  placeholder="Masukkan nama sesuai KTP" 
                  className="bg-background border-border h-10"
                  value={formData.fullName} 
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold flex items-center gap-2"><Fingerprint className="w-3.5 h-3.5 text-muted-foreground"/> NIK</Label>
                <Input 
                  placeholder="Contoh: 2024001" 
                  className="bg-background border-border h-10 font-mono"
                  value={formData.nik} 
                  onChange={(e) => setFormData({...formData, nik: e.target.value})} 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold flex items-center gap-2"><Building2 className="w-3.5 h-3.5 text-muted-foreground"/> Penempatan Kantor</Label>
                <Select 
                  value={String(formData.officeId)} 
                  onValueChange={(v) => setFormData({...formData, officeId: v})}
                >
                  <SelectTrigger className="bg-background border-border h-10">
                    <SelectValue placeholder="Pilih Lokasi" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="none">Belum Ditentukan</SelectItem>
                    {offices.map(o => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold flex items-center gap-2"><Briefcase className="w-3.5 h-3.5 text-muted-foreground"/> Departemen</Label>
                <Select 
                  value={String(formData.departmentId)}
                  onValueChange={(v) => setFormData({...formData, departmentId: v})}
                >
                  <SelectTrigger className="bg-background border-border h-10">
                    <SelectValue placeholder="Pilih Dept" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="none">Belum Ditentukan</SelectItem>
                    {departments.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Jabatan Resmi</Label>
                <Input 
                  placeholder="Contoh: Senior Manager" 
                  className="bg-background border-border h-10"
                  value={formData.jobTitle} 
                  onChange={(e) => setFormData({...formData, jobTitle: e.target.value})} 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Hak Akses Sistem</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(v: Role) => setFormData({...formData, role: v})}
                >
                  <SelectTrigger className="bg-background border-border h-10 font-bold text-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border font-bold">
                    <SelectItem value="user" className="flex items-center gap-2"><UserIcon className="w-3 h-3 inline mr-2"/> STAFF / USER</SelectItem>
                    <SelectItem value="admin" className="text-primary flex items-center gap-2"><ShieldCheck className="w-3 h-3 inline mr-2"/> ADMINISTRATOR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Label className="text-xs font-bold text-muted-foreground">Struktur Pelaporan (Atasan)</Label>
              <Select 
                value={formData.parentId || "none"} 
                onValueChange={(v) => setFormData({...formData, parentId: v})}
              >
                <SelectTrigger className="bg-background border-border h-11 border-dashed">
                  <SelectValue placeholder="Pilih Atasan Langsung" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border max-h-[200px]">
                  <SelectItem value="none" className="font-bold text-muted-foreground italic">Top Level / Board of Directors</SelectItem>
                  {allUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.fullName} — <span className="text-[10px] opacity-50">{u.jobTitle}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Footer dengan Glass Background */}
        <DialogFooter className="bg-secondary/50 p-6 gap-3 border-t border-border">
          <Button 
            variant="ghost" 
            onClick={onClose} 
            className="font-bold hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            Batalkan
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading} 
            className="min-w-[140px] bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold shadow-lg shadow-primary/20"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Mendaftarkan...
              </>
            ) : (
              "Simpan User"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};