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
import { UserPlus, Building2, Briefcase, Fingerprint, Mail, Lock } from 'lucide-react';

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
    departmentId: null as number | null,
    officeId: null as number | null,
    parentId: null as string | null
  });

  // Load master data saat modal dibuka
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
      
      // Reset form
      setFormData({
        email: '', password: '', fullName: '', nik: '',
        role: 'user', jobTitle: '', departmentId: null, officeId: null, parentId: null
      });
    }
  }, [isOpen]);

  const handleSave = async () => {
    // Validasi dasar
    if (!formData.email || !formData.fullName || !formData.nik || !formData.password) {
      return toast.error("Email, Password, Nama, dan NIK wajib diisi");
    }

    if (formData.password.length < 6) {
      return toast.error("Password minimal 6 karakter");
    }

    setLoading(true);
    try {
      /**
       * MAPPING PAYLOAD: 
       * Kita pastikan mengirim data yang bersih ke service.
       * Office & Dept dipastikan bertipe Number atau null (bukan string).
       */
      const payload = {
        ...formData,
        officeId: formData.officeId ? Number(formData.officeId) : null,
        departmentId: formData.departmentId ? Number(formData.departmentId) : null,
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
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <UserPlus className="w-5 h-5" />
            <DialogTitle>Registrasi Karyawan Baru</DialogTitle>
          </div>
          <DialogDescription>
            Masukkan data akun dan profil karyawan baru. Pastikan NIK sesuai dengan data HR.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-5 py-4">
          {/* Akun Section */}
          <div className="grid grid-cols-2 gap-4 border-b pb-4 bg-muted/30 p-4 rounded-lg">
            <div className="grid gap-2">
              <Label className="flex items-center gap-2"><Mail className="w-3 h-3"/> Email Kerja</Label>
              <Input 
                type="email" 
                placeholder="karyawan@perusahaan.com" 
                value={formData.email} 
                onChange={(e) => setFormData({...formData, email: e.target.value})} 
              />
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-2"><Lock className="w-3 h-3"/> Password</Label>
              <Input 
                type="password" 
                placeholder="Min. 6 Karakter" 
                value={formData.password} 
                onChange={(e) => setFormData({...formData, password: e.target.value})} 
              />
            </div>
          </div>

          {/* Profil Section */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Nama Lengkap</Label>
              <Input 
                placeholder="John Doe" 
                value={formData.fullName} 
                onChange={(e) => setFormData({...formData, fullName: e.target.value})} 
              />
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-1"><Fingerprint className="w-3 h-3"/> NIK</Label>
              <Input 
                placeholder="A-001" 
                value={formData.nik} 
                onChange={(e) => setFormData({...formData, nik: e.target.value})} 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="flex items-center gap-1"><Building2 className="w-3 h-3" /> Kantor</Label>
              <Select 
                value={formData.officeId ? String(formData.officeId) : "none"} 
                onValueChange={(v) => setFormData({...formData, officeId: v === "none" ? null : Number(v)})}
              >
                <SelectTrigger><SelectValue placeholder="Pilih Lokasi" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Belum Ditentukan</SelectItem>
                  {offices.map(o => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> Departemen</Label>
              <Select 
                value={formData.departmentId ? String(formData.departmentId) : "none"}
                onValueChange={(v) => setFormData({...formData, departmentId: v === "none" ? null : Number(v)})}
              >
                <SelectTrigger><SelectValue placeholder="Pilih Dept" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Belum Ditentukan</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Jabatan</Label>
              <Input 
                placeholder="Staff IT" 
                value={formData.jobTitle} 
                onChange={(e) => setFormData({...formData, jobTitle: e.target.value})} 
              />
            </div>
            <div className="grid gap-2">
              <Label>Role Akses</Label>
              <Select 
                value={formData.role} 
                onValueChange={(v: Role) => setFormData({...formData, role: v})}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User / Staff</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Atasan Langsung</Label>
            <Select 
              value={formData.parentId || "none"} 
              onValueChange={(v) => setFormData({...formData, parentId: v === "none" ? null : v})}
            >
              <SelectTrigger><SelectValue placeholder="Pilih Atasan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tidak Ada / Top Level</SelectItem>
                {allUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="bg-muted/50 -mx-6 -mb-6 p-4 rounded-b-lg gap-2">
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave} disabled={loading} className="min-w-[100px]">
            {loading ? "Proses..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};