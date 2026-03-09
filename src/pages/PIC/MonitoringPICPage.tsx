import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { picService } from '@/services/pic.service';
import { PICReviewDetail } from '@/components/pic/PICReviewDetail';
import { Search, FileText, Loader2, Inbox, MessageSquare, User, X,
         Building2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DeptInfo {
  dept_id: string;
  dept_name: string;
}

const getStatusBadge = (status: string | null) => {
  switch (status) {
    case 'SPK':              return { label: 'SPK',          cls: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20', Icon: CheckCircle2 };
    case 'KEUANGAN':         return { label: 'Keuangan',     cls: 'text-blue-600 bg-blue-500/10 border-blue-500/20',         Icon: CheckCircle2 };
    case 'REJECTED':         return { label: 'Ditolak',      cls: 'text-red-600 bg-red-500/10 border-red-500/20',            Icon: XCircle };
    case 'KEUANGAN_DONE':    return { label: 'Keu. Selesai', cls: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20', Icon: CheckCircle2 };
    case 'KEUANGAN_REJECTED':return { label: 'Keu. Tolak',  cls: 'text-red-600 bg-red-500/10 border-red-500/20',            Icon: XCircle };
    case 'PENDING':          return { label: 'Menunggu',     cls: 'text-amber-600 bg-amber-500/10 border-amber-500/20',      Icon: Clock };
    default:                 return { label: 'Review',       cls: 'text-slate-500 bg-slate-500/10 border-slate-500/20',      Icon: Clock };
  }
};

// ── Sub-component: Queue per departemen ───────────────────────────────────────
const DeptQueuePanel: React.FC<{ deptId: string; deptName: string; currentUserId: string }> = ({
  deptId, deptName, currentUserId
}) => {
  const [selectedSurat, setSelectedSurat] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [unreadMap, setUnreadMap] = useState<Map<string, number>>(new Map());
  const queryClient = useQueryClient();

  // Fetch queue untuk departemen ini saja
  const { data: queue = [], isLoading, refetch } = useQuery({
    queryKey: ['review-queue', deptId],
    queryFn: async () => {
      // 1. Forms milik dept ini
      const { data: forms } = await supabase
        .from('master_forms').select('id').eq('department_id', deptId);
      if (!forms?.length) return [];
      const formIds = forms.map((f: any) => f.id);

      // 2. Penggunaan dari form-form tersebut
      const { data: penggunaans } = await supabase
        .from('master_penggunaan_detail').select('id').in('form_id', formIds);
      if (!penggunaans?.length) return [];
      const penggunaanIds = penggunaans.map((p: any) => p.id);

      // 3. Surat DONE yang pakai penggunaan tersebut
      const { data, error } = await supabase
        .from('surat_registrasi')
        .select(`
          id, no_surat, judul_surat, status, pic_review_status, chat_status,
          created_by, updated_at, pic_attachment, file_path, lampiran_path,
          pic_note, pic_action_at, penggunaan_id,
          profiles:created_by(full_name)
        `)
        .eq('status', 'DONE')
        .in('penggunaan_id', penggunaanIds)
        .order('updated_at', { ascending: false });

      if (error) { console.error(error); return []; }
      // Tampilkan semua surat — PENDING dan yang sudah diproses
      return (data || []) as any[];
    },
    enabled: !!deptId,
  });

  // Hitung unread per surat
  useEffect(() => {
    if (!queue.length) return;
    const suratIds = queue.map((s: any) => s.id);
    supabase.from('surat_chats')
      .select('surat_id')
      .in('surat_id', suratIds)
      .eq('sender_role', 'creator')
      .eq('is_read', false)
      .eq('is_system', false)
      .then(({ data }) => {
        const m = new Map<string, number>();
        (data ?? []).forEach((c: any) => m.set(c.surat_id, (m.get(c.surat_id) ?? 0) + 1));
        setUnreadMap(m);
      });
  }, [queue]);

  // Listen chat-read event untuk refresh badge
  useEffect(() => {
    const refresh = () => refetch();
    window.addEventListener('chat-read', refresh);
    return () => window.removeEventListener('chat-read', refresh);
  }, [refetch]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel(`pic-queue-${deptId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'surat_registrasi' }, () => refetch())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'surat_chats' }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [deptId, refetch]);

  const filtered = queue.filter((item: any) =>
    item.judul_surat?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.no_surat?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingCount = queue.filter((s: any) => !s.pic_review_status || s.pic_review_status === 'PENDING').length;
  const totalUnread = Array.from(unreadMap.values()).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Search + stats */}
      <div className="px-4 py-3 border-b border-border bg-secondary/5 space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
            <Inbox size={11} /> {filtered.length} dokumen
          </span>
          {pendingCount > 0 && (
            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
              {pendingCount} menunggu
            </span>
          )}
          {totalUnread > 0 && (
            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 animate-pulse">
              {totalUnread} pesan baru
            </span>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
          <input
            placeholder="Cari dokumen..."
            className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary/20"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Split view */}
      <div className="flex flex-1 overflow-hidden">
        {/* List */}
        <div className={`flex flex-col border-r border-border ${selectedSurat ? 'w-[320px] shrink-0' : 'flex-1'}`}>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="animate-spin text-primary mb-2" size={20} />
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Memuat...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center opacity-40">
                <Inbox className="mx-auto mb-3" size={32} />
                <p className="text-xs font-bold uppercase">Tidak ada dokumen</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {filtered.map((item: any) => {
                  const badge = getStatusBadge(item.pic_review_status);
                  const isActive = selectedSurat?.id === item.id;
                  const unread = unreadMap.get(item.id) ?? 0;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedSurat(item)}
                      className={`p-3.5 cursor-pointer transition-all hover:bg-secondary/40 flex gap-3 relative border-l-2 ${
                        isActive ? 'bg-secondary/60 border-primary' : 'border-transparent'
                      }`}
                    >
                      {/* Badge unread */}
                      {unread > 0 && (
                        <span className="absolute top-3 right-3 bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-tight">
                          {unread}
                        </span>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1 pr-5">
                          <div className={`flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${badge.cls}`}>
                            <badge.Icon size={9} /> {badge.label}
                          </div>
                          <span className="text-[9px] text-muted-foreground font-mono">
                            {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true, locale: localeID })}
                          </span>
                        </div>
                        <h3 className={`text-[13px] font-bold truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>
                          {item.judul_surat}
                        </h3>
                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5 opacity-70 truncate">
                          {item.no_surat ?? '—'}
                        </p>
                        {item.profiles?.[0]?.full_name && (
                          <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-1">
                            <User size={9} /> {item.profiles[0].full_name}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selectedSurat && (
          <div className="flex-1 relative overflow-hidden animate-in fade-in slide-in-from-right-2 duration-200">
            <button
              onClick={() => setSelectedSurat(null)}
              className="absolute top-3 right-4 z-50 p-1.5 bg-background/80 backdrop-blur shadow-sm border border-border rounded-full text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
            <div className="h-full">
              <PICReviewDetail
                surat={selectedSurat}
                onActionComplete={() => {
                  setSelectedSurat(null);
                  queryClient.invalidateQueries({ queryKey: ['review-queue', deptId] });
                  refetch();
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const MonitoringPICPage = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [depts, setDepts] = useState<DeptInfo[]>([]);
  const [activeDeptId, setActiveDeptId] = useState<string>('');

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles').select('id, full_name, role').eq('id', user.id).single();
      setCurrentUser(profile);

      // Ambil semua departemen yang di-PIC user ini
      const { data: deptPics } = await supabase
        .from('master_dept_pics')
        .select('dept_id, master_departments!master_dept_pics_dept_id_fkey(id, name)')
        .eq('user_id', user.id);

      if (deptPics?.length) {
        const list: DeptInfo[] = deptPics.map((dp: any) => {
          const dept = Array.isArray(dp.master_departments) ? dp.master_departments[0] : dp.master_departments;
          return { dept_id: dp.dept_id, dept_name: dept?.name ?? dp.dept_id };
        });
        setDepts(list);
        setActiveDeptId(list[0]?.dept_id ?? '');
      } else if (profile?.role === 'admin') {
        // Admin: tampilkan semua departemen
        const { data: allDepts } = await supabase
          .from('master_departments').select('id, name').order('name');
        if (allDepts?.length) {
          const list = allDepts.map((d: any) => ({ dept_id: d.id, dept_name: d.name }));
          setDepts(list);
          setActiveDeptId(list[0]?.dept_id ?? '');
        }
      }
    };
    init();
  }, []);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Toaster position="top-right" />

      {/* HEADER */}
      <header className="px-6 py-4 border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-black tracking-tighter text-primary">ANTREAN REVIEW PIC</h1>
          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border bg-primary/10 text-primary border-primary/20">
            {depts.length} Departemen
          </span>
        </div>
        <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mt-0.5">
          Review dokumen per departemen yang Anda tangani
        </p>
      </header>

      {/* TAB DEPARTEMEN */}
      {depts.length > 1 && (
        <div className="flex items-center gap-1 px-6 pt-4 pb-0 border-b border-border shrink-0 overflow-x-auto">
          {depts.map(dept => (
            <button
              key={dept.dept_id}
              onClick={() => setActiveDeptId(dept.dept_id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-black uppercase tracking-wide transition-all border-b-2 whitespace-nowrap ${
                activeDeptId === dept.dept_id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Building2 size={12} /> {dept.dept_name}
            </button>
          ))}
        </div>
      )}

      {/* CONTENT */}
      <div className="flex-1 overflow-hidden">
        {depts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-40">
            <Building2 size={48} className="mb-4 text-muted-foreground" />
            <p className="text-sm font-black uppercase tracking-widest">Tidak ada departemen</p>
            <p className="text-[10px] text-muted-foreground mt-1">Anda belum ditugaskan sebagai PIC</p>
          </div>
        ) : (
          depts.map(dept => (
            <div key={dept.dept_id} className={`h-full ${activeDeptId === dept.dept_id ? 'block' : 'hidden'}`}>
              <DeptQueuePanel
                deptId={dept.dept_id}
                deptName={dept.dept_name}
                currentUserId={currentUser.id}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MonitoringPICPage;