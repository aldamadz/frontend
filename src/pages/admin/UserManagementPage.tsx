// frontend/src/pages/UserManagementPage.tsx
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getUsers } from '@/services/user.service';
import { User } from '@/types/agenda';
import * as XLSX from 'xlsx';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Edit2, Users, ShieldCheck, User as UserIcon, Search, Plus, MapPin,
  Building2, Briefcase, Loader2, Download, Upload, ToggleLeft,
  ToggleRight, Phone, CheckCircle2, XCircle, AlertCircle, Calendar,
  Clock, FileSpreadsheet, LogOut, KeyRound, Mail, Hash, Info,
  ChevronLeft, ChevronRight, X, List,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { AddUserModal } from '@/components/users/AddUserModal';
import { EditUserModal } from '@/components/users/EditUserModal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMasaKerja(joinDate?: string | null, resignDate?: string | null): string {
  if (!joinDate) return '—';
  const start = new Date(joinDate);
  const end   = resignDate ? new Date(resignDate) : new Date();
  if (isNaN(start.getTime())) return '—';

  let years  = end.getFullYear() - start.getFullYear();
  let months = end.getMonth()    - start.getMonth();
  let days   = end.getDate()     - start.getDate();

  if (days < 0) {
    months--;
    days += new Date(end.getFullYear(), end.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  const parts: string[] = [];
  if (years  > 0) parts.push(`${years} tahun`);
  if (months > 0) parts.push(`${months} bulan`);
  if (days   > 0) parts.push(`${days} hari`);
  return parts.length > 0 ? parts.join(' ') : '0 hari';
}

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Detail User Modal ──────────────────────────────────────────────────────────
interface DetailUserModalProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onEdit: (u: User) => void;
  onToggle: (u: User) => void;
  togglingId: string | null;
}

const DetailUserModal = ({ user, open, onClose, onEdit, onToggle, togglingId }: DetailUserModalProps) => {
  const [resetting, setResetting] = useState(false);

  if (!user) return null;

  const isActive   = (user as any).is_active !== false;
  const isToggling = togglingId === user.id;
  const joinDate   = (user as any).join_date;
  const resignDate = (user as any).resign_date;
  const masaKerja  = getMasaKerja(joinDate, resignDate);
  const role       = (user as any).role || 'user';

  const handleResetPassword = async () => {
    if (!confirm(`Reset password ${user.fullName} ke "marison123"?`)) return;
    setResetting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ action: 'reset_password', user_id: user.id }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`Password ${user.fullName} berhasil direset ke "marison123"`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setResetting(false);
    }
  };

  const roleConfig = ({
    admin: { label: 'Admin', cls: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    user:  { label: 'User',  cls: 'bg-secondary text-muted-foreground border-border',       icon: <UserIcon className="w-3.5 h-3.5" /> },
  } as any)[role] ?? { label: role, cls: 'bg-secondary text-muted-foreground border-border', icon: <UserIcon className="w-3.5 h-3.5" /> };

  const Field = ({ icon, label, value, mono = false }: { icon: React.ReactNode; label: string; value?: string | null; mono?: boolean }) => (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5 text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className={cn("text-sm font-semibold text-foreground mt-0.5 break-all", mono && "font-mono text-xs")}>{value || '—'}</p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden border-border">
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-background px-8 pt-8 pb-6 border-b border-border">
          <div className="flex items-center gap-6">
            <div className="relative shrink-0">
              <Avatar className="h-20 w-20 border-2 border-primary/20 ring-4 ring-background shadow-lg">
                <AvatarImage src={(user as any).photoUrl} />
                <AvatarFallback className="bg-primary/10 text-primary font-extrabold text-2xl uppercase">
                  {user.fullName.substring(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className={cn(
                "absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-background flex items-center justify-center",
                isActive ? "bg-emerald-500" : "bg-red-500"
              )}>
                {isActive ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <XCircle className="w-3.5 h-3.5 text-white" />}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black text-foreground leading-tight">{user.fullName}</h2>
              <p className="text-sm text-muted-foreground font-medium mt-0.5">{user.jobTitle || 'Staff'}</p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border", roleConfig.cls)}>
                  {roleConfig.icon} {roleConfig.label}
                </span>
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border",
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border-red-500/20"
                )}>
                  {isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-x-8 gap-y-0">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
                <Info className="w-3 h-3" /> Data Karyawan
              </p>
              <Field icon={<Mail className="w-3.5 h-3.5" />}      label="Email"      value={user.email} mono />
              <Field icon={<Hash className="w-3.5 h-3.5" />}      label="NIK"        value={user.nik} mono />
              <Field icon={<Phone className="w-3.5 h-3.5" />}     label="No. HP"     value={(user as any).phone} />
              <Field icon={<Briefcase className="w-3.5 h-3.5" />} label="Jabatan"    value={user.jobTitle} />
              <Field icon={<Building2 className="w-3.5 h-3.5" />} label="Departemen" value={user.departmentName} />
              <Field icon={<MapPin className="w-3.5 h-3.5" />}    label="Kantor"     value={user.officeName} />
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
                  <Clock className="w-3 h-3" /> Riwayat Kerja
                </p>
                <div className="bg-muted/30 rounded-2xl p-4 space-y-3 border border-border/50">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase">Bergabung</span>
                    </div>
                    <span className="text-xs font-bold text-foreground">{formatDate(joinDate)}</span>
                  </div>
                  {resignDate && (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-red-400">
                        <LogOut className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase">Keluar</span>
                      </div>
                      <span className="text-xs font-bold text-red-400">{formatDate(resignDate)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1 border-t border-border/50">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Masa Kerja</span>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase border",
                      resignDate
                        ? "bg-red-500/10 text-red-400 border-red-500/20"
                        : "bg-primary/10 text-primary border-primary/20"
                    )}>
                      {masaKerja}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
                  <KeyRound className="w-3 h-3" /> Keamanan Akun
                </p>
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-black uppercase text-amber-400">Reset Password</p>
                      <p className="text-[10px] text-muted-foreground font-medium mt-0.5 leading-relaxed">
                        Password akan direset ke default{' '}
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">marison123</span>.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleResetPassword}
                    disabled={resetting}
                    variant="outline"
                    className="w-full h-9 rounded-xl border-amber-500/30 text-amber-500 hover:bg-amber-500/10 font-black uppercase text-[10px] tracking-widest"
                  >
                    {resetting
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />Mereset...</>
                      : <><KeyRound className="w-3.5 h-3.5 mr-2" />Reset ke "marison123"</>
                    }
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-7 py-4 border-t border-border bg-muted/10 flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => onToggle(user)}
            disabled={isToggling}
            className={cn(
              "flex-1 h-10 rounded-xl font-black uppercase text-[10px] tracking-widest",
              isActive
                ? "border-red-500/30 text-red-500 hover:bg-red-500/10"
                : "border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
            )}
          >
            {isToggling
              ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
              : isActive
                ? <><ToggleLeft className="w-3.5 h-3.5 mr-2" />Nonaktifkan</>
                : <><ToggleRight className="w-3.5 h-3.5 mr-2" />Aktifkan</>
            }
          </Button>
          <Button
            onClick={() => { onClose(); onEdit(user); }}
            className="flex-1 h-10 rounded-xl font-black uppercase text-[10px] tracking-widest"
          >
            <Edit2 className="w-3.5 h-3.5 mr-2" /> Edit Profil
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full h-9 rounded-xl font-bold text-xs uppercase text-muted-foreground">
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Constants ─────────────────────────────────────────────────────────────────
const TEMPLATE_EXAMPLE_EMAILS = new Set(['budi@marison.id', 'siti@marison.id']);
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

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
  const [bulkLoading, setBulkLoading]   = useState(false);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);
  const importRef = useRef<HTMLInputElement>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try { setUsers(await getUsers()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const uniqueOffices = useMemo(() =>
    Array.from(new Set(users.map(u => u.officeName).filter(Boolean))).sort() as string[], [users]);
  const uniqueDepts = useMemo(() =>
    Array.from(new Set(users.map(u => u.departmentName).filter(Boolean))).sort() as string[], [users]);

  const filteredUsers = useMemo(() => users.filter(u => {
    const s = searchQuery.toLowerCase();
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

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchQuery, officeFilter, deptFilter, statusFilter, pageSize]);

  const showAll    = pageSize === 'all';
  const totalPages = showAll ? 1 : Math.max(1, Math.ceil(filteredUsers.length / (pageSize as number)));
  const pagedUsers = useMemo(() =>
    showAll
      ? filteredUsers
      : filteredUsers.slice((page - 1) * (pageSize as number), page * (pageSize as number)),
    [filteredUsers, page, pageSize, showAll]
  );

  const allPageSelected  = pagedUsers.length > 0 && pagedUsers.every(u => selectedIds.has(u.id));
  const somePageSelected = pagedUsers.some(u => selectedIds.has(u.id));

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (allPageSelected) pagedUsers.forEach(u => n.delete(u.id));
      else pagedUsers.forEach(u => n.add(u.id));
      return n;
    });
  }, [allPageSelected, pagedUsers]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const clearSelection = () => setSelectedIds(new Set());
  const selectedUsers  = useMemo(() => users.filter(u => selectedIds.has(u.id)), [users, selectedIds]);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  };

  const bulkToggle = async (activate: boolean) => {
    if (!confirm(`${activate ? 'Aktifkan' : 'Nonaktifkan'} ${selectedUsers.length} akun?`)) return;
    setBulkLoading(true);
    const token = await getToken();
    let ok = 0, fail = 0;
    for (const u of selectedUsers) {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'toggle_active', user_id: u.id, is_active: activate }),
        });
        if (res.ok) ok++; else fail++;
      } catch { fail++; }
    }
    toast.success(`${activate ? 'Aktivasi' : 'Nonaktifkan'}: ${ok} berhasil${fail ? `, ${fail} gagal` : ''}`);
    setBulkLoading(false);
    clearSelection();
    fetchUsers();
  };

  const bulkResetPassword = async () => {
    if (!confirm(`Reset password ${selectedUsers.length} akun ke "marison123"?`)) return;
    setBulkLoading(true);
    const token = await getToken();
    let ok = 0, fail = 0;
    for (const u of selectedUsers) {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'reset_password', user_id: u.id }),
        });
        if (res.ok) ok++; else fail++;
      } catch { fail++; }
    }
    toast.success(`Reset password: ${ok} berhasil${fail ? `, ${fail} gagal` : ''}`);
    setBulkLoading(false);
    clearSelection();
  };

  const handleToggle = async (user: User) => {
    const newVal = !(user as any).is_active;
    setTogglingId(user.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'toggle_active', user_id: user.id, is_active: newVal }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`Akun ${user.fullName} ${newVal ? 'diaktifkan' : 'dinonaktifkan'}`);
      fetchUsers();
    } catch (err: any) { toast.error(err.message); }
    finally { setTogglingId(null); }
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/templates/template_import_karyawan.xlsx';
    link.download = 'template_import_karyawan.xlsx';
    link.click();
  };

  const handleExport = () => {
    const rows = filteredUsers.map((u, idx) => ({
      'No':            idx + 1,
      'Nama Lengkap':  u.fullName,
      'Email':         u.email || '',
      'NIK':           u.nik || '',
      'No. HP':        (u as any).phone || '',
      'Jabatan':       u.jobTitle || '',
      'Role':          (u as any).role || 'user',
      'Departemen':    u.departmentName || '',
      'Kantor':        u.officeName || '',
      'Tgl Bergabung': (u as any).join_date || '',
      'Tgl Keluar':    (u as any).resign_date || '',
      'Masa Kerja':    getMasaKerja((u as any).join_date, (u as any).resign_date),
      'Status':        (u as any).is_active === false ? 'Nonaktif' : 'Aktif',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 5 }, { wch: 28 }, { wch: 32 }, { wch: 16 }, { wch: 18 },
      { wch: 22 }, { wch: 12 }, { wch: 24 }, { wch: 20 },
      { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 12 },
    ];
    ws['!rows'] = [{ hpt: 28 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Karyawan');
    XLSX.writeFile(wb, `karyawan_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${rows.length} data diekspor ke Excel`);
  };

  const parseXlsxToRows = (file: File): Promise<string[][]> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = new Uint8Array(ev.target!.result as ArrayBuffer);
          const wb   = XLSX.read(data, { type: 'array' });
          const ws   = wb.Sheets[wb.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][]);
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (importRef.current) importRef.current.value = '';

    type ImportRow = { nik: string; full_name: string; phone: string; email: string; join_date: string; resign_date: string; job_title: string; role: string };
    const dataRows: ImportRow[] = [];

    try {
      const isXlsx = /\.(xlsx|xls)$/i.test(file.name);
      if (isXlsx) {
        const allRows = await parseXlsxToRows(file);
        const headerRowIdx = allRows.findIndex(r =>
          r.some(c => typeof c === 'string' && ['email', 'nama', 'name'].includes(String(c).trim().toLowerCase().replace(' *', '')))
        );
        const startIdx = headerRowIdx >= 0 ? headerRowIdx + 1 : 3;
        for (let i = startIdx; i < allRows.length; i++) {
          const r = allRows[i].map(v => String(v ?? '').trim());
          const [nik, full_name, phone, email, join_date, resign_date, job_title, role] = r;
          if (!email && !full_name) continue;
          if (TEMPLATE_EXAMPLE_EMAILS.has(email.toLowerCase())) continue;
          if (!email || !full_name) continue;
          dataRows.push({ nik, full_name, phone, email, join_date, resign_date, job_title, role });
        }
      } else {
        const text  = await file.text();
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) return toast.error('File CSV kosong');
        for (const line of lines.slice(1)) {
          const cols = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
          const [nik, full_name, phone, email, join_date, resign_date, job_title, role] = cols;
          if (!email || !full_name) continue;
          if (TEMPLATE_EXAMPLE_EMAILS.has(email.toLowerCase())) continue;
          dataRows.push({ nik, full_name, phone, email, join_date, resign_date, job_title, role });
        }
      }
    } catch {
      return toast.error('Gagal membaca file. Pastikan format file benar.');
    }

    if (dataRows.length === 0) return toast.warning('Tidak ada data valid untuk diimpor.');

    let ok = 0, fail = 0;
    const { data: { session } } = await supabase.auth.getSession();
    toast.info(`Mengimpor ${dataRows.length} karyawan...`);

    for (const row of dataRows) {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({
            action:      'create',
            email:       row.email,
            full_name:   row.full_name,
            job_title:   row.job_title   || null,
            phone:       row.phone       || null,
            role:        ['admin','user'].includes((row.role||'').toLowerCase()) ? row.role.toLowerCase() : 'user',
            join_date:   row.join_date   || null,
            resign_date: row.resign_date || null,
          }),
        });
        if (res.ok) ok++; else fail++;
      } catch { fail++; }
    }

    toast.success(`Import selesai: ${ok} berhasil${fail > 0 ? `, ${fail} gagal` : ''}`);
    fetchUsers();
  };

  const activeCount   = users.filter(u => (u as any).is_active !== false).length;
  const inactiveCount = users.length - activeCount;

  const StatPill = ({ icon, label, value, cls }: { icon: React.ReactNode; label: string; value: number; cls: string }) => (
    <div className={cn("hidden sm:flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-bold", cls)}>
      {icon}<span>{value} {label}</span>
    </div>
  );

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-7 bg-background text-foreground min-h-screen">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 border-b border-border pb-7">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight text-gradient uppercase">Manajemen User</h1>
          <p className="text-muted-foreground text-sm">Kelola hak akses, jabatan, kontak, dan riwayat masa kerja karyawan.</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <StatPill icon={<Users className="w-4 h-4" />}        label="Total"    value={users.length}  cls="bg-primary/10 text-primary border-primary/20" />
          <StatPill icon={<CheckCircle2 className="w-4 h-4" />} label="Aktif"    value={activeCount}   cls="bg-emerald-500/10 text-emerald-500 border-emerald-500/20" />
          {inactiveCount > 0 && <StatPill icon={<XCircle className="w-4 h-4" />} label="Nonaktif" value={inactiveCount} cls="bg-red-500/10 text-red-500 border-red-500/20" />}
          <Button variant="outline" onClick={handleDownloadTemplate}
            className="h-10 gap-2 font-bold text-xs uppercase rounded-xl border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10">
            <FileSpreadsheet className="w-4 h-4" /> Template
          </Button>
          <Button variant="outline" onClick={() => importRef.current?.click()}
            className="h-10 gap-2 font-bold text-xs uppercase rounded-xl">
            <Upload className="w-4 h-4" /> Import
          </Button>
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          <Button variant="outline" onClick={handleExport}
            className="h-10 gap-2 font-bold text-xs uppercase rounded-xl border-primary/30 text-primary hover:bg-primary/10">
            <Download className="w-4 h-4" /> Export XLSX
          </Button>
          <Button onClick={() => setIsAddOpen(true)} className="h-10 px-5 font-bold text-xs uppercase rounded-xl">
            <Plus className="w-4 h-4 mr-1.5" /> Tambah Karyawan
          </Button>
        </div>
      </div>

      {/* ── Filter toolbar ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 glass-card p-4 rounded-2xl">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cari nama, email, NIK, HP..." className="pl-10 bg-secondary/50 border-border"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        {[
          { val: statusFilter, set: setStatusFilter, icon: <AlertCircle className="w-4 h-4 text-primary" />, ph: "Status Akun",
            opts: [["all","Semua Status"],["active","Aktif"],["inactive","Nonaktif"]] },
          { val: officeFilter, set: setOfficeFilter, icon: <Building2 className="w-4 h-4 text-primary" />,   ph: "Kantor",
            opts: [["all","Semua Kantor"], ...uniqueOffices.map(o => [o,o])] },
          { val: deptFilter,   set: setDeptFilter,   icon: <Briefcase className="w-4 h-4 text-primary" />,   ph: "Departemen",
            opts: [["all","Semua Departemen"], ...uniqueDepts.map(d => [d,d])] },
        ].map(({ val, set, icon, ph, opts }) => (
          <Select key={ph} value={val} onValueChange={set}>
            <SelectTrigger className="bg-secondary/50 border-border">
              <div className="flex items-center gap-2">{icon}<SelectValue placeholder={ph} /></div>
            </SelectTrigger>
            <SelectContent>
              {opts.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        ))}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="elevated-card rounded-2xl overflow-hidden border-border/40">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="w-12 py-5 pl-5">
                <Checkbox
                  checked={allPageSelected}
                  ref={(el) => { if (el) (el as any).indeterminate = somePageSelected && !allPageSelected; }}
                  onCheckedChange={toggleSelectAll}
                  className="border-muted-foreground/40"
                />
              </TableHead>
              {["Karyawan","No. HP","Role","Jabatan & Unit","Masa Kerja"].map(h => (
                <TableHead key={h} className="py-5 font-bold text-muted-foreground uppercase tracking-wider text-[11px]">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="py-32">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="text-muted-foreground font-medium animate-pulse text-sm">Memuat data karyawan...</p>
                </div>
              </TableCell></TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-32 text-center">
                <div className="max-w-xs mx-auto space-y-3 opacity-40">
                  <Search className="w-12 h-12 mx-auto" />
                  <p className="text-lg font-medium">Data tidak ditemukan</p>
                </div>
              </TableCell></TableRow>
            ) : pagedUsers.map(user => {
              const isActive    = (user as any).is_active !== false;
              const joinDate    = (user as any).join_date;
              const resignDate  = (user as any).resign_date;
              const masaKerja   = getMasaKerja(joinDate, resignDate);
              const hasResigned = !!resignDate;
              const isSelected  = selectedIds.has(user.id);

              return (
                <TableRow
                  key={user.id}
                  className={cn(
                    "border-border transition-colors cursor-pointer",
                    isSelected ? "bg-primary/5 hover:bg-primary/8" : "hover:bg-accent/30",
                    !isActive && "opacity-60"
                  )}
                >
                  <TableCell className="pl-5 w-12" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(user.id)}
                      className="border-muted-foreground/40"
                    />
                  </TableCell>

                  <TableCell className="py-3.5" onClick={() => { setSelectedUser(user); setIsDetailOpen(true); }}>
                    <div className="flex items-center gap-3.5">
                      <div className="relative shrink-0">
                        <Avatar className="h-11 w-11 border-2 border-primary/20 ring-2 ring-background shadow">
                          <AvatarImage src={user.photoUrl} />
                          <AvatarFallback className="bg-secondary text-primary font-extrabold text-sm uppercase">
                            {user.fullName.substring(0,2)}
                          </AvatarFallback>
                        </Avatar>
                        {!isActive && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-background flex items-center justify-center">
                            <XCircle className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-foreground truncate">{user.fullName}</p>
                        <p className="text-xs text-primary/70 font-medium truncate">{user.email}</p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">NIK: {user.nik || '—'}</p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell onClick={() => { setSelectedUser(user); setIsDetailOpen(true); }}>
                    {(user as any).phone ? (
                      <div className="flex items-center gap-1.5 text-sm text-foreground/80 font-medium">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        {(user as any).phone}
                      </div>
                    ) : <span className="text-muted-foreground/40 text-xs font-bold">—</span>}
                  </TableCell>

                  <TableCell onClick={() => { setSelectedUser(user); setIsDetailOpen(true); }}>
                    {(user as any).role === 'admin' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <ShieldCheck className="w-3 h-3" /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-secondary text-muted-foreground border border-border">
                        <UserIcon className="w-3 h-3" /> User
                      </span>
                    )}
                  </TableCell>

                  <TableCell onClick={() => { setSelectedUser(user); setIsDetailOpen(true); }}>
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-foreground/90">{user.jobTitle || 'Staff'}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-md font-extrabold uppercase">
                          {user.departmentName || '—'}
                        </span>
                        {user.officeName && (
                          <span className="flex items-center text-[10px] text-muted-foreground/80 font-bold bg-accent/40 px-2 py-0.5 rounded-md">
                            <MapPin className="w-2.5 h-2.5 mr-1" />{user.officeName}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell onClick={() => { setSelectedUser(user); setIsDetailOpen(true); }}>
                    <div className="space-y-1">
                      {joinDate ? (
                        <>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase">
                            <Calendar className="w-3 h-3 shrink-0" />{formatDate(joinDate)}
                          </div>
                          {hasResigned && (
                            <div className="flex items-center gap-1.5 text-[10px] text-red-400 font-bold uppercase">
                              <LogOut className="w-3 h-3 shrink-0" />{formatDate(resignDate)}
                            </div>
                          )}
                          <div className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border mt-0.5",
                            hasResigned
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : "bg-primary/10 text-primary border-primary/20"
                          )}>
                            <Clock className="w-2.5 h-2.5" /> {masaKerja}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs font-bold">Belum diisi</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* ── Bulk Action Bar ──────────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>{selectedIds.size} dipilih</span>
          </div>
          <div className="w-px h-5 bg-primary/20" />
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={bulkResetPassword} disabled={bulkLoading}
              className="h-8 gap-1.5 text-[10px] font-bold uppercase rounded-xl border-amber-500/30 text-amber-600 hover:bg-amber-500/10">
              {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />} Reset Password
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkToggle(true)} disabled={bulkLoading}
              className="h-8 gap-1.5 text-[10px] font-bold uppercase rounded-xl border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10">
              {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ToggleRight className="w-3 h-3" />} Aktifkan
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkToggle(false)} disabled={bulkLoading}
              className="h-8 gap-1.5 text-[10px] font-bold uppercase rounded-xl border-red-500/30 text-red-500 hover:bg-red-500/10">
              {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ToggleLeft className="w-3 h-3" />} Nonaktifkan
            </Button>
          </div>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={clearSelection} className="h-8 w-8 p-0 rounded-xl hover:bg-destructive/10">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {!loading && filteredUsers.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              {showAll
                ? `Menampilkan semua ${filteredUsers.length} karyawan`
                : `${(page - 1) * (pageSize as number) + 1}–${Math.min(page * (pageSize as number), filteredUsers.length)} dari ${filteredUsers.length} karyawan`}
              {filteredUsers.length !== users.length && ` (total ${users.length})`}
              {selectedIds.size > 0 && <span className="text-primary"> · {selectedIds.size} dipilih</span>}
            </p>
            <div className="flex items-center gap-1.5 bg-muted/40 border border-border rounded-xl px-2.5 py-1">
              <List className="w-3 h-3 text-muted-foreground shrink-0" />
              <Select value={String(pageSize)} onValueChange={v => setPageSize(v === 'all' ? 'all' : Number(v))}>
                <SelectTrigger className="h-6 border-0 bg-transparent p-0 pr-5 text-[10px] font-black uppercase focus:ring-0 focus:ring-offset-0 w-auto min-w-[64px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {PAGE_SIZE_OPTIONS.map(n => (
                    <SelectItem key={n} value={String(n)} className="text-[11px] font-bold">{n} / halaman</SelectItem>
                  ))}
                  <SelectItem value="all" className="text-[11px] font-bold text-primary">Tampilkan Semua</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!showAll && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                Hal {page} / {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}
                  className="h-8 w-8 p-0 rounded-lg text-xs font-bold">1</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="h-8 w-8 p-0 rounded-lg"><ChevronLeft className="w-4 h-4" /></Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && typeof arr[idx-1] === 'number' && (p as number) - (arr[idx-1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) => p === '...'
                    ? <span key={`e-${i}`} className="text-xs text-muted-foreground px-1">…</span>
                    : <Button key={p} variant={page === p ? 'default' : 'outline'} size="sm"
                        onClick={() => setPage(p as number)}
                        className="h-8 w-8 p-0 rounded-lg text-xs font-bold">{p}</Button>
                  )}
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="h-8 w-8 p-0 rounded-lg"><ChevronRight className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages}
                  className="h-8 w-8 p-0 rounded-lg text-xs font-bold">{totalPages}</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <AddUserModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={fetchUsers}
        allUsers={users}
      />
      <DetailUserModal
        user={selectedUser}
        open={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onEdit={(u) => { setSelectedUser(u); setIsEditOpen(true); }}
        onToggle={handleToggle}
        togglingId={togglingId}
      />
      <EditUserModal
        user={selectedUser}
        allUsers={users}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={fetchUsers}
      />
    </div>
  );
}