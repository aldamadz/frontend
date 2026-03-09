import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Loader2, ClipboardList, Search, RefreshCw } from 'lucide-react';
import { Department } from './Types';
import { DepartmentQueue } from './DepartmentQueue';

// ── Main Page ─────────────────────────────────────────────────────────────

const MonitoringPICPage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string } | null>(null);
  const [search, setSearch] = useState('');

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('id, full_name').eq('id', user.id).single()
        .then(({ data }) => setCurrentUser(data));
    });
  }, []);

  // Fetch departments yang punya surat assigned ke PIC ini
  const { data: departments = [], isLoading, refetch, isFetching } = useQuery<Department[]>({
    queryKey: ['pic-departments', currentUser?.id],
    enabled: !!currentUser,
    queryFn: async () => {
      // Ambil dept yang ada suratnya untuk PIC ini
      const { data, error } = await supabase
        .from('surat_registrasi')
        .select('dept_id')
        .eq('status', 'DONE')
        .eq('pic_id', currentUser!.id);

      if (error) throw error;

      const deptIds = [...new Set((data ?? []).map((s: any) => s.dept_id).filter(Boolean))];
      if (deptIds.length === 0) return [];

      const { data: depts, error: deptErr } = await supabase
        .from('master_departments')
        .select('id, name, code, dept_index')
        .in('id', deptIds)
        .order('dept_index');

      if (deptErr) throw deptErr;
      return depts ?? [];
    },
    refetchInterval: 30_000, // auto refresh tiap 30 detik
  });

  const filteredDepts = departments.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.code ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <ClipboardList size={20} className="text-primary" />
              <h1 className="text-base font-black uppercase tracking-[0.15em] text-foreground">
                Antrian Review PIC
              </h1>
            </div>
            <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest">
              {currentUser?.full_name ?? '...'} — kelola pengajuan per departemen
            </p>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-[10px] font-black uppercase tracking-wider hover:bg-secondary transition-all text-muted-foreground"
          >
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* ── Search ── */}
        <div className="relative mb-6">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari departemen..."
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/40"
          />
        </div>

        {/* ── Content ── */}
        {isLoading || !currentUser ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 size={24} className="animate-spin text-primary/40" />
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              Memuat data antrian...
            </p>
          </div>
        ) : filteredDepts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-30">
            <ClipboardList size={48} strokeWidth={1} />
            <div className="text-center">
              <p className="text-sm font-black uppercase tracking-widest">Tidak ada antrian</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {search ? 'Departemen tidak ditemukan' : 'Belum ada pengajuan yang perlu direview'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDepts.map(dept => (
              <DepartmentQueue
                key={dept.id}
                dept={dept}
                picId={currentUser.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MonitoringPICPage;