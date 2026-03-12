// frontend/src/pages/UserManagementPage.tsx
import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getUsers } from '@/services/user.service';
import { User } from '@/types/agenda';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Edit2, Users, ShieldCheck, User as UserIcon, Search, Plus, MapPin,
  Building2, Briefcase, Loader2, Download, Upload, ToggleLeft, ToggleRight,
  Phone, CheckCircle2, XCircle, AlertCircle, Calendar, Clock, FileSpreadsheet,
  LogOut, Eye, KeyRound, Mail, Briefcase as BriefcaseIcon, Hash,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { EditUserModal } from '@/components/users/EditUserModal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMasaKerja(joinDate?: string | null, resignDate?: string | null): string {
  if (!joinDate) return '—';
  const start = new Date(joinDate);
  const end   = resignDate ? new Date(resignDate) : new Date();
  const totalMonths =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (totalMonths < 1) return '< 1 bln';
  const years  = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${months} bln`;
  if (months === 0) return `${years} thn`;
  return `${years} thn ${months} bln`;
}

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function callAdminFn(token: string, body: object) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json;
}

// ── Export ke XLSX via SheetJS ────────────────────────────────────────────────
async function exportToXlsx(users: User[]) {
  let XLSX: any = (window as any).XLSX;
  if (!XLSX) {
    try {
      const mod = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs' as any);
      XLSX = mod;
    } catch {
      toast.error('Gagal memuat library Excel. Pastikan koneksi internet aktif.');
      return;
    }
  }

  const now = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

  const rows = users.map(u => ({
    'NIK':                u.nik || '',
    'NAMA':               u.fullName,
    'NO HP':              (u as any).phone || '',
    'EMAIL':              u.email || '',
    'JABATAN':            u.jobTitle || '',
    'ROLE':               (u as any).role || 'user',
    'DEPARTEMEN':         u.departmentName || '',
    'KANTOR':             u.officeName || '',
    'TANGGAL BERGABUNG':  (u as any).join_date || '',
    'TANGGAL KELUAR':     (u as any).resign_date || '',
    'MASA KERJA':         getMasaKerja((u as any).join_date, (u as any).resign_date),
    'STATUS':             (u as any).is_active === false ? 'Nonaktif' : 'Aktif',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  ws['!cols'] = [
    { wch: 14 }, { wch: 28 }, { wch: 18 }, { wch: 30 }, { wch: 22 }, { wch: 10 },
    { wch: 26 }, { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 10 },
  ];

  // Style header row (row 1)
  const headerKeys = Object.keys(rows[0] || {});
  headerKeys.forEach((_, ci) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (!ws[cellRef]) return;
    ws[cellRef].s = {
      font:      { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 10 },
      fill:      { fgColor: { rgb: '0F172A' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top:    { style: 'thin', color: { rgb: 'CBD5E1' } },
        bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
        left:   { style: 'thin', color: { rgb: 'CBD5E1' } },
        right:  { style: 'thin', color: { rgb: 'CBD5E1' } },
      },
    };
  });

  // Style data rows — zebra, dengan warna merah untuk status Nonaktif
  rows.forEach((row, ri) => {
    const isAlt = ri % 2 === 0;
    headerKeys.forEach((key, ci) => {
      const cellRef = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
      if (!ws[cellRef]) return;
      const isNonaktif = key === 'STATUS' && row[key as keyof typeof row] === 'Nonaktif';
      const isKeluar   = key === 'TANGGAL KELUAR' && row[key as keyof typeof row];
      ws[cellRef].s = {
        font: {
          name: 'Arial', sz: 10,
          bold:  isNonaktif,
          color: { rgb: isNonaktif ? 'DC2626' : isKeluar ? 'EF4444' : '0F172A' },
        },
        fill: { fgColor: { rgb: isAlt ? 'F8FAFC' : 'FFFFFF' } },
        alignment: { vertical: 'center', wrapText: false },
        border: {
          top:    { style: 'thin', color: { rgb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
          left:   { style: 'thin', color: { rgb: 'E2E8F0' } },
          right:  { style: 'thin', color: { rgb: 'E2E8F0' } },
        },
      };
    });
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data Karyawan');

  // Set row height via SheetJS (requires write option)
  ws['!rows'] = [{ hpt: 28 }]; // header row height

  XLSX.writeFile(wb, `karyawan_${new Date().toISOString().slice(0, 10)}.xlsx`, { bookSST: false, type: 'binary', cellStyles: true });
  toast.success(`${users.length} data diekspor ke Excel`);
}

// ── Add User Modal ────────────────────────────────────────────────────────────
interface AddUserModalProps {
  open: boolean; onClose: () => void; onSuccess: () => void;
  departments: any[]; offices: any[];
}

const AddUserModal = ({ open, onClose, onSuccess, departments, offices }: AddUserModalProps) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: '', full_name: '', job_title: '', phone: '',
    role: 'user', department_id: '', office_id: '', join_date: '', resign_date: '',
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.email || !form.full_name) return toast.error('Email dan nama lengkap wajib diisi');
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await callAdminFn(session!.access_token, { action: 'create', ...form });
      toast.success(`Akun ${form.full_name} dibuat. Password: marison123`);
      onSuccess(); onClose();
      setForm({ email: '', full_name: '', job_title: '', phone: '', role: 'user', department_id: '', office_id: '', join_date: '', resign_date: '' });
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl rounded-3xl p-8">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight">Tambah Karyawan Baru</DialogTitle>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
            Password default: <span className="text-primary font-mono bg-primary/10 px-2 py-0.5 rounded">marison123</span>
          </p>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">Nama Lengkap *</Label>
              <Input value={form.full_name} onChange={set('full_name')} placeholder="John Doe" className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">Email *</Label>
              <Input type="email" value={form.email} onChange={set('email')} placeholder="john@marison.id" className="rounded-xl h-11" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">Jabatan</Label>
              <Input value={form.job_title} onChange={set('job_title')} placeholder="Staff" className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">No. HP</Label>
              <Input value={form.phone} onChange={set('phone')} placeholder="08xxxxxxxxxx" className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">Role</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">Tanggal Bergabung</Label>
              <Input type="date" value={form.join_date} onChange={set('join_date')} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">Tanggal Keluar</Label>
              <Input type="date" value={form.resign_date} onChange={set('resign_date')} className="rounded-xl h-11" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">Departemen</Label>
              <Select value={form.department_id} onValueChange={v => setForm(f => ({ ...f, department_id: v }))}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Pilih" /></SelectTrigger>
                <SelectContent>{departments.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">Kantor</Label>
              <Select value={form.office_id} onValueChange={v => setForm(f => ({ ...f, office_id: v }))}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Pilih" /></SelectTrigger>
                <SelectContent>{offices.map(o => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-2xl">Batal</Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-2xl px-8 font-black uppercase text-xs">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />} Buat Akun
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Detail Modal ──────────────────────────────────────────────────────────────
interface DetailModalProps {
  user: User | null; open: boolean; onClose: () => void;
  onResetPassword: (u: User) => void;
  onToggle: (u: User) => void;
  isToggling: boolean;
}

const DetailModal = ({ user, open, onClose, onResetPassword, onToggle, isToggling }: DetailModalProps) => {
  if (!user) return null;
  const isActive   = (user as any).is_active !== false;
  const joinDate   = (user as any).join_date;
  const resignDate = (user as any).resign_date;

  const roleLabel = (user as any).role === 'admin' ? 'Administrator'
    : (user as any).role === 'finance' ? 'Finance'
    : 'User / Staff';
  const roleClass = (user as any).role === 'admin'
    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
    : (user as any).role === 'finance'
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : 'bg-secondary text-muted-foreground border-border';

  const InfoRow = ({ icon, label, value, sub, valueClass = '' }: {
    icon: React.ReactNode; label: string; value: string; sub?: string; valueClass?: string;
  }) => (
    <div className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0">
      <div className="w-8 h-8 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
        <p className={cn("text-sm font-semibold text-foreground break-all leading-snug", valueClass)}>{value || '—'}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-border/50">

        {/* ── Hero header ─────────────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-br from-primary/20 via-primary/8 to-background p-7 pb-5">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/60 pointer-events-none" />
          <div className="relative flex items-start gap-5">
            <div className="relative shrink-0">
              <Avatar className="h-20 w-20 border-4 border-background ring-2 ring-primary/30 shadow-2xl">
                <AvatarImage src={(user as any).photoUrl} />
                <AvatarFallback className="bg-primary/15 text-primary font-extrabold text-2xl uppercase">
                  {user.fullName.substring(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className={cn(
                "absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-3 border-background flex items-center justify-center shadow-md",
                isActive ? "bg-emerald-500" : "bg-red-500"
              )}>
                {isActive
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  : <XCircle className="w-3.5 h-3.5 text-white" />}
              </div>
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h2 className="text-xl font-black text-foreground tracking-tight leading-tight">{user.fullName}</h2>
              <p className="text-sm text-muted-foreground mt-0.5 font-medium">{user.jobTitle || 'Staff'}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border", roleClass)}>
                  <ShieldCheck className="w-3 h-3" /> {roleLabel}
                </span>
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border",
                  isActive ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
                )}>
                  {isActive ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
                  {isActive ? 'Aktif' : 'Nonaktif'}
                </span>
                {joinDate && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border bg-primary/10 text-primary border-primary/20">
                    <Clock className="w-3 h-3" /> {getMasaKerja(joinDate, resignDate)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Info body ───────────────────────────────────────────────────── */}
        <div className="px-6 py-2 max-h-[42vh] overflow-y-auto">
          <InfoRow icon={<Hash className="w-3.5 h-3.5 text-muted-foreground" />}    label="NIK"               value={user.nik || '—'} valueClass="font-mono" />
          <InfoRow icon={<Mail className="w-3.5 h-3.5 text-muted-foreground" />}    label="Email"             value={user.email || '—'} />
          <InfoRow icon={<Phone className="w-3.5 h-3.5 text-muted-foreground" />}   label="No. HP"            value={(user as any).phone || '—'} />
          <InfoRow icon={<BriefcaseIcon className="w-3.5 h-3.5 text-muted-foreground" />} label="Jabatan"     value={user.jobTitle || '—'} />
          <InfoRow icon={<Building2 className="w-3.5 h-3.5 text-muted-foreground" />}    label="Departemen"  value={user.departmentName || '—'} />
          <InfoRow icon={<MapPin className="w-3.5 h-3.5 text-muted-foreground" />}  label="Kantor"            value={user.officeName || '—'} />
          <InfoRow icon={<Calendar className="w-3.5 h-3.5 text-muted-foreground" />} label="Tanggal Bergabung" value={formatDate(joinDate)} />
          {resignDate && (
            <InfoRow icon={<LogOut className="w-3.5 h-3.5 text-red-400" />} label="Tanggal Keluar"
              value={formatDate(resignDate)} valueClass="text-red-400" />
          )}
        </div>

        {/* ── Footer actions ──────────────────────────────────────────────── */}
        <div className="px-6 pb-6 pt-3 border-t border-border/40 bg-muted/5">
          <div className="flex flex-wrap gap-2 pt-3">
            <Button variant="outline" size="sm" onClick={() => onResetPassword(user)}
              className="gap-2 rounded-xl border-amber-500/30 text-amber-600 hover:bg-amber-500/10 font-bold text-[10px] uppercase tracking-widest h-9">
              <KeyRound className="w-3.5 h-3.5" /> Reset Password
            </Button>
            <Button variant="outline" size="sm" onClick={() => onToggle(user)} disabled={isToggling}
              className={cn("gap-2 rounded-xl font-bold text-[10px] uppercase tracking-widest h-9",
                isActive
                  ? "border-red-500/30 text-red-500 hover:bg-red-500/10"
                  : "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10")}>
              {isToggling
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : isActive ? <ToggleLeft className="w-3.5 h-3.5" /> : <ToggleRight className="w-3.5 h-3.5" />}
              {isActive ? 'Nonaktifkan' : 'Aktifkan'}
            </Button>
            <div className="flex-1" />
            <Button size="sm" onClick={onClose} className="rounded-xl font-bold text-xs uppercase px-6 h-9">
              Tutup
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function UserManagementPage() {
  const [users, setUsers]               = useState<User[]>([]);
  const [loading, setLoading]           = useState(true);
  const [searchQuery, setSearchQuery]   = useState('');
  const [officeFilter, setOfficeFilter] = useState('all');
  const [deptFilter, setDeptFilter]     = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditOpen, setIsEditOpen]     = useState(false);
  const [isAddOpen, setIsAddOpen]       = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [togglingId, setTogglingId]     = useState<string | null>(null);
  const [departments, setDepartments]   = useState<any[]>([]);
  const [offices, setOffices]           = useState<any[]>([]);
  const importRef = useRef<HTMLInputElement>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try { setUsers(await getUsers()); } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchUsers();
    supabase.from('departments').select('id,name').order('name').then(({ data }) => setDepartments(data || []));
    supabase.from('offices').select('id,name').order('name').then(({ data }) => setOffices(data || []));
  }, []);

  const uniqueOffices = useMemo(() =>
    Array.from(new Set(users.map(u => u.officeName).filter(Boolean))).sort() as string[], [users]);
  const uniqueDepts = useMemo(() =>
    Array.from(new Set(users.map(u => u.departmentName).filter(Boolean))).sort() as string[], [users]);

  const filteredUsers = useMemo(() => users.filter(u => {
    const s  = searchQuery.toLowerCase();
    const ok = u.fullName.toLowerCase().includes(s)
      || (u.email?.toLowerCase() || '').includes(s)
      || (u.jobTitle?.toLowerCase() || '').includes(s)
      || (u.nik?.toLowerCase() || '').includes(s)
      || ((u as any).phone?.toLowerCase() || '').includes(s);
    const isActive = (u as any).is_active !== false;
    return ok
      && (officeFilter === 'all' || u.officeName === officeFilter)
      && (deptFilter   === 'all' || u.departmentName === deptFilter)
      && (statusFilter === 'all' || (statusFilter === 'active' ? isActive : !isActive));
  }), [users, searchQuery, officeFilter, deptFilter, statusFilter]);

  const getToken = async () => {
    // Coba refresh dulu agar token tidak expired
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      // Paksa refresh token
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (!refreshed.session) throw new Error('Sesi tidak ditemukan, silakan login ulang');
      return refreshed.session.access_token;
    }
    // Jika token sudah dekat expired (<60 detik), refresh
    const expiresAt = session.expires_at ?? 0;
    if (expiresAt - Math.floor(Date.now() / 1000) < 60) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed.session) return refreshed.session.access_token;
    }
    return session.access_token;
  };

  const handleToggle = async (user: User) => {
    const newVal = !(user as any).is_active;
    setTogglingId(user.id);
    try {
      await callAdminFn(await getToken(), { action: 'toggle_active', user_id: user.id, is_active: newVal });
      toast.success(`Akun ${user.fullName} ${newVal ? 'diaktifkan' : 'dinonaktifkan'}`);
      fetchUsers();
    } catch (err: any) { toast.error(err.message); }
    finally { setTogglingId(null); }
  };

  const handleResetPassword = async (user: User) => {
    if (!confirm(`Reset password ${user.fullName} ke "marison123"?`)) return;
    try {
      await callAdminFn(await getToken(), { action: 'reset_password', user_id: user.id });
      toast.success(`Password ${user.fullName} direset ke marison123`);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDownloadTemplate = () => {
    const a = document.createElement('a');
    a.href = '/templates/template_import_karyawan.xlsx';
    a.download = 'template_import_karyawan.xlsx';
    a.click();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (importRef.current) importRef.current.value = '';
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return toast.error('File CSV kosong');
    let ok = 0, fail = 0;
    const token = await getToken();
    toast.info(`Mengimpor ${lines.length - 1} baris...`);
    for (const line of lines.slice(1)) {
      const cols = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
      const [nik, full_name, phone, email, join_date, resign_date, job_title, role] = cols;
      if (!email || !full_name) { fail++; continue; }
      try {
        await callAdminFn(token, { action: 'create', email, full_name, job_title, phone, role: role || 'user', join_date: join_date || null, resign_date: resign_date || null });
        ok++;
      } catch { fail++; }
    }
    toast.success(`Import selesai: ${ok} berhasil, ${fail} gagal`);
    fetchUsers();
  };

  const openDetail = (user: User) => { setSelectedUser(user); setIsDetailOpen(true); };
  const openEdit   = (user: User) => { setSelectedUser(user); setIsEditOpen(true); };

  const activeCount   = users.filter(u => (u as any).is_active !== false).length;
  const inactiveCount = users.length - activeCount;

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-7 bg-background text-foreground min-h-screen">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 border-b border-border pb-7">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gradient uppercase">Manajemen User</h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola hak akses, jabatan, kontak, dan riwayat masa kerja karyawan.</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Stats */}
          <div className="hidden sm:flex items-center gap-2 bg-primary/10 text-primary px-4 py-2.5 rounded-xl border border-primary/20 text-sm font-bold">
            <Users className="w-4 h-4" /> {users.length} Total
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-4 py-2.5 rounded-xl border border-emerald-500/20 text-sm font-bold">
            <CheckCircle2 className="w-4 h-4" /> {activeCount} Aktif
          </div>
          {inactiveCount > 0 && (
            <div className="hidden sm:flex items-center gap-2 bg-red-500/10 text-red-500 px-4 py-2.5 rounded-xl border border-red-500/20 text-sm font-bold">
              <XCircle className="w-4 h-4" /> {inactiveCount} Nonaktif
            </div>
          )}

          <div className="w-px h-8 bg-border hidden sm:block" />

          <Button variant="outline" onClick={handleDownloadTemplate} title="Download Template Excel"
            className="h-10 gap-2 font-bold text-xs uppercase rounded-xl border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10">
            <FileSpreadsheet className="w-4 h-4" /> Template
          </Button>
          <Button variant="outline" onClick={() => importRef.current?.click()} className="h-10 gap-2 font-bold text-xs uppercase rounded-xl">
            <Upload className="w-4 h-4" /> Import
          </Button>
          <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <Button variant="outline" onClick={() => exportToXlsx(filteredUsers)} className="h-10 gap-2 font-bold text-xs uppercase rounded-xl">
            <Download className="w-4 h-4" /> Export Excel
          </Button>
          <Button onClick={() => setIsAddOpen(true)} className="h-10 px-5 font-bold text-xs uppercase rounded-xl">
            <Plus className="w-4 h-4 mr-1.5" /> Tambah Karyawan
          </Button>
        </div>
      </div>

      {/* ── Filter ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 glass-card p-4 rounded-2xl">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cari nama, email, NIK, HP..." className="pl-10 bg-secondary/50 border-border"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        {([
          { val: statusFilter, fn: setStatusFilter, icon: <AlertCircle className="w-4 h-4 text-primary" />, ph: "Status Akun",
            opts: [["all","Semua Status"],["active","Aktif"],["inactive","Nonaktif"]] as [string,string][] },
          { val: officeFilter, fn: setOfficeFilter, icon: <Building2   className="w-4 h-4 text-primary" />, ph: "Kantor",
            opts: [["all","Semua Kantor"],   ...uniqueOffices.map(o => [o,o])] as [string,string][] },
          { val: deptFilter,   fn: setDeptFilter,   icon: <Briefcase   className="w-4 h-4 text-primary" />, ph: "Departemen",
            opts: [["all","Semua Departemen"], ...uniqueDepts.map(d => [d,d])] as [string,string][] },
        ]).map(({ val, fn, icon, ph, opts }) => (
          <Select key={ph} value={val} onValueChange={fn as any}>
            <SelectTrigger className="bg-secondary/50 border-border">
              <div className="flex items-center gap-2">{icon}<SelectValue placeholder={ph} /></div>
            </SelectTrigger>
            <SelectContent>
              {opts.map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        ))}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="elevated-card rounded-2xl overflow-hidden border-border/40">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="py-5 font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Karyawan</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">No. HP</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Role</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Jabatan & Unit</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Masa Kerja</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Status</TableHead>
              <TableHead className="text-right font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="py-32">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="text-muted-foreground text-sm font-medium animate-pulse">Memuat data karyawan...</p>
                </div>
              </TableCell></TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-32 text-center">
                <div className="max-w-xs mx-auto space-y-3 opacity-40">
                  <Search className="w-12 h-12 mx-auto" />
                  <p className="text-lg font-medium">Data tidak ditemukan</p>
                </div>
              </TableCell></TableRow>
            ) : filteredUsers.map(user => {
              const isActive   = (user as any).is_active !== false;
              const isToggling = togglingId === user.id;
              const joinDate   = (user as any).join_date;
              const resignDate = (user as any).resign_date;
              const hasResigned = !!resignDate;

              return (
                <TableRow key={user.id} className={cn("hover:bg-accent/30 border-border transition-colors", !isActive && "opacity-60 bg-muted/5")}>

                  {/* Karyawan */}
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-3.5">
                      <div className="relative shrink-0">
                        <Avatar className="h-11 w-11 border-2 border-primary/20 ring-2 ring-background shadow">
                          <AvatarImage src={(user as any).photoUrl} />
                          <AvatarFallback className="bg-secondary text-primary font-extrabold text-sm uppercase">
                            {user.fullName.substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        {!isActive && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-background" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-foreground truncate">{user.fullName}</p>
                        <p className="text-xs text-primary/70 font-medium truncate">{user.email}</p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">NIK: {user.nik || '—'}</p>
                      </div>
                    </div>
                  </TableCell>

                  {/* No HP */}
                  <TableCell>
                    {(user as any).phone
                      ? <div className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />{(user as any).phone}
                        </div>
                      : <span className="text-muted-foreground/40 text-xs font-bold">—</span>}
                  </TableCell>

                  {/* Role */}
                  <TableCell>
                    {(user as any).role === 'admin'
                      ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"><ShieldCheck className="w-3 h-3" /> Admin</span>
                      : (user as any).role === 'finance'
                      ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="w-3 h-3" /> Finance</span>
                      : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-secondary text-muted-foreground border border-border"><UserIcon className="w-3 h-3" /> User</span>}
                  </TableCell>

                  {/* Jabatan & Unit */}
                  <TableCell>
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-foreground/90">{user.jobTitle || 'Staff'}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-md font-extrabold uppercase">{user.departmentName || '—'}</span>
                        {user.officeName && (
                          <span className="flex items-center text-[10px] text-muted-foreground/80 font-bold bg-accent/40 px-2 py-0.5 rounded-md">
                            <MapPin className="w-2.5 h-2.5 mr-1" />{user.officeName}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Masa Kerja */}
                  <TableCell>
                    {joinDate ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold">
                          <Calendar className="w-3 h-3 shrink-0" /> {formatDate(joinDate)}
                        </div>
                        {hasResigned && (
                          <div className="flex items-center gap-1.5 text-[10px] text-red-400 font-bold">
                            <LogOut className="w-3 h-3 shrink-0" /> {formatDate(resignDate)}
                          </div>
                        )}
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border",
                          hasResigned ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-primary/10 text-primary border-primary/20"
                        )}>
                          <Clock className="w-2.5 h-2.5" /> {getMasaKerja(joinDate, resignDate)}
                        </span>
                      </div>
                    ) : <span className="text-muted-foreground/40 text-xs font-bold">Belum diisi</span>}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <button onClick={() => handleToggle(user)} disabled={isToggling}
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                        isActive
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                          : "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/20"
                      )}>
                      {isToggling
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : isActive ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                      {isActive ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </TableCell>

                  {/* Aksi */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Detail */}
                      <Button variant="ghost" size="sm" onClick={() => openDetail(user)}
                        title="Lihat Detail"
                        className="h-9 w-9 p-0 rounded-xl hover:bg-primary/10 hover:text-primary text-muted-foreground">
                        <Eye className="w-4 h-4" />
                      </Button>
                      {/* Reset Password */}
                      <Button variant="ghost" size="sm" onClick={() => handleResetPassword(user)}
                        title="Reset Password"
                        className="h-9 w-9 p-0 rounded-xl hover:bg-amber-500/10 hover:text-amber-500 text-muted-foreground">
                        <KeyRound className="w-4 h-4" />
                      </Button>
                      {/* Edit */}
                      <Button variant="secondary" size="sm" onClick={() => openEdit(user)}
                        className="h-9 px-3 font-bold hover:bg-primary hover:text-primary-foreground transition-all rounded-xl border border-border text-xs">
                        <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Kelola
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      {!loading && (
        <p className="text-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest pb-4">
          Menampilkan {filteredUsers.length} dari {users.length} karyawan
        </p>
      )}

      {/* Modals */}
      <AddUserModal open={isAddOpen} onClose={() => setIsAddOpen(false)} onSuccess={fetchUsers} departments={departments} offices={offices} />

      <DetailModal
        user={selectedUser}
        open={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onResetPassword={handleResetPassword}
        onToggle={async (u) => { await handleToggle(u); }}
        isToggling={togglingId === selectedUser?.id}
      />

      <EditUserModal user={selectedUser} allUsers={users} isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} onSuccess={fetchUsers} />
    </div>
  );
}