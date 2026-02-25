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
import { supabase } from '@/lib/supabase';
import { Building2, Briefcase, UserCog, UserCircle, Fingerprint, Mail, Loader2, ShieldCheck, User as UserIcon } from 'lucide-react';

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
  
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    nik: '',
    role: 'user' as Role,
    jobTitle: '',
    departmentId: 'none' as string | number,
    officeId: 'none' as string | number,
    parentId: 'none' as string
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

  // 2. Sinkronkan data user ke Form saat modal dibuka
  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        email: user.email || '',
        fullName: user.fullName || '',
        nik: user.nik || '',
        role: (user.role as Role) || 'user',
        jobTitle: user.jobTitle || '',
        departmentId: user.departmentId ? String(user.departmentId) : 'none',
        officeId: user.officeId ? String(user.officeId) : 'none',
        parentId: user.parentId || 'none'
      });
    }
  }, [user, isOpen]);

  const handleSave = async () => {
    if (!user) return;
    
    if (!formData.email || !formData.fullName || !formData.nik) {
      return toast.error("Email, Nama, dan NIK wajib diisi");
    }

    setLoading(true);
    try {
      // STEP 1: Sinkronisasi AUTH via Edge Function
      const { error: edgeError } = await supabase.functions.invoke('admin-update-user', {
        body: { 
          userId: user.id, 
          newEmail: formData.email, 
          newFullName: formData.fullName 
        }
      });

      if (edgeError) throw new Error(`Auth Update Error: ${edgeError.message}`);

      // STEP 2: Update Profile
      const payload = {
        fullName: formData.fullName,
        email: formData.email,
        nik: formData.nik,
        jobTitle: formData.jobTitle,
        role: formData.role,
        officeId: formData.officeId === "none" ? null : Number(formData.officeId),
        departmentId: formData.departmentId === "none" ? null : Number(formData.departmentId),
        parentId: formData.parentId === "none" ? null : formData.parentId
      };

      await updateUserProfile(user.id, payload);
      
      toast.success("Data karyawan berhasil diperbarui");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Update Error:", error);
      toast.error("Gagal memperbarui: " + (error.message || "Terjadi kesalahan"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border shadow-2xl p-0 overflow-hidden">
        <div className="p-6 pb-0">
          <DialogHeader>
            <div className="flex items-center gap-3 text-primary mb-1">
              <div className="p-2 bg-primary/10 rounded-lg">
                <UserCog className="w-6 h-6" />
              </div>
              <DialogTitle className="text-2xl font-extrabold tracking-tight">Edit Profil Karyawan</DialogTitle>
            </div>
            <DialogDescription className="text-muted-foreground font-medium">
              Update kredensial login dan informasi struktural karyawan.
            </DialogDescription>
          </DialogHeader>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Section 1: Akun & Identitas Utama */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-primary tracking-[0.2em] uppercase px-1">Kredensial & Identitas</h4>
            <div className="grid grid-cols-2 gap-4 bg-secondary/30 p-4 rounded-xl border border-border/50">
              <div className="space-y-2">
                <Label className="text-xs font-bold flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email Kerja
                </Label>
                <Input 
                  type="email"
                  value={formData.email} 
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="bg-background h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold flex items-center gap-2">
                  <UserCircle className="w-3.5 h-3.5 text-muted-foreground" /> Nama Lengkap
                </Label>
                <Input 
                  value={formData.fullName} 
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  className="bg-background h-10"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Detail Organisasi */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-primary tracking-[0.2em] uppercase px-1">Informasi Jabatan</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold flex items-center gap-2">
                  <Fingerprint className="w-3.5 h-3.5 text-muted-foreground" /> NIK
                </Label>
                <Input 
                  value={formData.nik} 
                  placeholder="A-001"
                  className={`h-10 font-mono ${formData.nik?.includes('PENDING') ? "border-destructive bg-destructive/5 text-destructive" : "bg-background"}`}
                  onChange={(e) => setFormData({...formData, nik: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Hak Akses</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(v: Role) => setFormData({...formData, role: v})}
                >
                  <SelectTrigger className="h-10 font-bold text-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user"><UserIcon className="w-3 h-3 inline mr-2"/> STAFF</SelectItem>
                    <SelectItem value="admin"><ShieldCheck className="w-3 h-3 inline mr-2"/> ADMIN</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" /> Kantor
                </Label>
                <Select 
                  value={String(formData.officeId)}
                  onValueChange={(v) => setFormData({...formData, officeId: v})}
                >
                  <SelectTrigger className="h-10 bg-background">
                    <SelectValue placeholder="Pilih Kantor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Belum Ditentukan</SelectItem>
                    {offices.map((off) => (
                      <SelectItem key={off.id} value={String(off.id)}>{off.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5 text-muted-foreground" /> Departemen
                </Label>
                <Select 
                  value={String(formData.departmentId)}
                  onValueChange={(v) => setFormData({...formData, departmentId: v})}
                >
                  <SelectTrigger className="h-10 bg-background">
                    <SelectValue placeholder="Pilih Dept" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Belum Ditentukan</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={String(dept.id)}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Jabatan</Label>
                <Input 
                  placeholder="Manager IT"
                  value={formData.jobTitle} 
                  className="h-10 bg-background"
                  onChange={(e) => setFormData({...formData, jobTitle: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Atasan Langsung</Label>
                <Select 
                  value={formData.parentId || "none"}
                  onValueChange={(v) => setFormData({...formData, parentId: v})}
                >
                  <SelectTrigger className="h-10 bg-background">
                    <SelectValue placeholder="Pilih Atasan" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    <SelectItem value="none" className="italic text-muted-foreground">Tidak Ada (Top Level)</SelectItem>
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
          </div>
        </div>

        <DialogFooter className="bg-secondary/50 p-6 gap-3 border-t border-border mt-2">
          <Button variant="ghost" type="button" onClick={onClose} disabled={loading} className="font-bold">
            Batalkan
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading} 
            className="min-w-[160px] bg-primary text-primary-foreground font-extrabold shadow-lg shadow-primary/20"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sinkronisasi...
              </>
            ) : "Simpan Perubahan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};