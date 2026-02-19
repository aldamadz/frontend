// frontend/src/components/users/EditUserModal.tsx
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
import { updateUserProfile } from '@/services/user.service';
import { getDepartments, Department } from '@/services/department.service';
import { getOffices } from '@/services/office.service';
import { Office } from '@/types/office';
import { toast } from 'sonner';
import { Building2, Briefcase, UserCog, UserCircle, Fingerprint } from 'lucide-react';

interface EditUserModalProps {
  user: User | null;
  allUsers: User[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditUserModal = ({ user, allUsers, isOpen, onClose, onSuccess }: EditUserModalProps) => {
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  
  const [formData, setFormData] = useState<Partial<User>>({
    fullName: '',
    nik: '',
    role: 'user',
    jobTitle: '',
    departmentId: null,
    officeId: null,
    parentId: null
  });

  // 1. Fetch Master Data
  useEffect(() => {
    if (isOpen) {
      const loadMasterData = async () => {
        try {
          const [depts, offs] = await Promise.all([
            getDepartments(),
            getOffices()
          ]);
          setDepartments(depts);
          setOffices(offs);
        } catch (error) {
          console.error("Failed to load master data", error);
        }
      };
      loadMasterData();
    }
  }, [isOpen]);

  // 2. Sinkronkan data user ke Form
  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        fullName: user.fullName || '',
        nik: user.nik || '',
        role: user.role || 'user',
        departmentId: user.departmentId,
        officeId: user.officeId,
        jobTitle: user.jobTitle || '',
        parentId: user.parentId // Nilainya bisa UUID atau null
      });
    }
  }, [user, isOpen]);

  const handleSave = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // PERBAIKAN LOGIKA PAYLOAD
      const payload = {
        fullName: formData.fullName,
        nik: formData.nik,
        jobTitle: formData.jobTitle,
        role: formData.role,
        officeId: formData.officeId,
        departmentId: formData.departmentId,
        // Pastikan jika "none" dikirim sebagai null agar kolom di DB terupdate jadi NULL
        parentId: (formData.parentId === "none" || !formData.parentId) ? null : formData.parentId
      };

      console.log("Mengirim update untuk parentId:", payload.parentId);

      await updateUserProfile(user.id, payload);
      
      toast.success("Profil user berhasil diperbarui");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Update Error:", error);
      toast.error("Gagal memperbarui profil: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <UserCog className="w-5 h-5" />
            <DialogTitle>Edit Profil Karyawan</DialogTitle>
          </div>
          <DialogDescription>
            Sesuaikan informasi identitas, jabatan, dan penempatan kerja karyawan.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-5 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <UserCircle className="w-4 h-4" /> Nama Lengkap
              </Label>
              <Input 
                value={formData.fullName || ''} 
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <Fingerprint className="w-4 h-4" /> NIK
              </Label>
              <Input 
                value={formData.nik || ''} 
                placeholder="Masukkan NIK asli"
                className={formData.nik?.includes('PENDING') ? "border-red-500 bg-red-50" : ""}
                onChange={(e) => setFormData({...formData, nik: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Jabatan</Label>
              <Input 
                placeholder="Contoh: Manager"
                value={formData.jobTitle || ''} 
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

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Kantor
              </Label>
              <Select 
                value={formData.officeId ? String(formData.officeId) : "none"}
                onValueChange={(v) => setFormData({...formData, officeId: v === "none" ? null : Number(v)})}
              >
                <SelectTrigger><SelectValue placeholder="Pilih Kantor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Belum Ditentukan</SelectItem>
                  {offices.map((off) => (
                    <SelectItem key={off.id} value={String(off.id)}>{off.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-1">
                <Briefcase className="w-3 h-3" /> Departemen
              </Label>
              <Select 
                value={formData.departmentId ? String(formData.departmentId) : "none"}
                onValueChange={(v) => setFormData({...formData, departmentId: v === "none" ? null : Number(v)})}
              >
                <SelectTrigger><SelectValue placeholder="Pilih Dept" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Belum Ditentukan</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={String(dept.id)}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2 border-t pt-4">
            <Label>Atasan Langsung (Hirarki)</Label>
            <Select 
              value={formData.parentId || "none"}
              onValueChange={(v) => setFormData({...formData, parentId: v === "none" ? null : v})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih Atasan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Top Level (Tidak ada atasan)</SelectItem>
                {allUsers
                  .filter(u => u.id !== user?.id) 
                  .map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.fullName}</SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="bg-muted/50 -mx-6 -mb-6 p-4 rounded-b-lg">
          <Button variant="outline" type="button" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};