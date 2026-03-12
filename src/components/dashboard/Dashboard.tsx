// frontend/src/pages/dashboard/Dashboard.tsx
import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  startOfDay, endOfDay, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, subMonths, subWeeks,
  addMonths, addWeeks, isSameMonth, isSameWeek,
  format,
} from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import {
  ChevronLeft, ChevronRight, CalendarDays, CalendarRange,
  FileText, LayoutList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Components
import { KPICard }          from './KPICard';
import { StatusChart }      from './StatusChart';
import { DepartmentChart }  from './DepartmentChart';
import { RecentActivity }   from './RecentActivity';
import { Skeleton }         from '@/components/ui/skeleton';
import { AgendaParentFilter } from '@/components/agenda/AgendaParentFilter';
import { SuratSummaryCards }  from './SuratSummaryCards';

// Services
import {
  getDashboardKPI,
  getStatusDistribution,
  getRecentActivities,
  getDepartmentActivity,
} from '@/services/dashboard.service';
import { getUsers, isParentUser } from '@/services';
import { ActivityLog } from '@/types/agenda';

import { useAuth } from '@/hooks/use-auth';

// ── Tipe periode ──────────────────────────────────────────────────────────────
type PeriodMode = 'month' | 'week';

// ── Helper: label + range dari satu periode ───────────────────────────────────
const getPeriodRange = (mode: PeriodMode, anchor: Date) => {
  if (mode === 'month') {
    return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  }
  return {
    start: startOfWeek(anchor, { weekStartsOn: 1 }),
    end:   endOfWeek(anchor,   { weekStartsOn: 1 }),
  };
};

const getPeriodLabel = (mode: PeriodMode, anchor: Date): string => {
  if (mode === 'month') return format(anchor, 'MMMM yyyy', { locale: localeID });
  const s = startOfWeek(anchor, { weekStartsOn: 1 });
  const e = endOfWeek(anchor,   { weekStartsOn: 1 });
  if (isSameMonth(s, e)) return `${format(s, 'd')}–${format(e, 'd MMM yyyy', { locale: localeID })}`;
  return `${format(s, 'd MMM', { locale: localeID })} – ${format(e, 'd MMM yyyy', { locale: localeID })}`;
};

const isCurrentPeriod = (mode: PeriodMode, anchor: Date) => {
  const now = new Date();
  return mode === 'month'
    ? isSameMonth(anchor, now)
    : isSameWeek(anchor, now, { weekStartsOn: 1 });
};

// ── Sub-komponen: PeriodNav ───────────────────────────────────────────────────
interface PeriodNavProps {
  label: string;
  mode: PeriodMode;
  onMode: (m: PeriodMode) => void;
  onBack: () => void;
  onForward: () => void;
  onToday: () => void;
  isCurrent: boolean;
  icon: React.ReactNode;
  title: string;
  accentClass: string;
}

const PeriodNav = ({
  label, mode, onMode, onBack, onForward, onToday, isCurrent, icon, title, accentClass,
}: PeriodNavProps) => (
  <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm">
    {/* Title */}
    <div className="flex items-center gap-2">
      <div className={cn("w-1 h-4 rounded-full", accentClass)} />
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {icon} {title}
      </div>
    </div>

    {/* Controls */}
    <div className="flex items-center gap-2">
      {/* Mode toggle */}
      <div className="flex bg-muted p-0.5 rounded-lg shrink-0">
        <button
          onClick={() => onMode('month')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase transition-all',
            mode === 'month' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
          )}
        >
          <CalendarDays className="w-3 h-3" /> Bulan
        </button>
        <button
          onClick={() => onMode('week')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase transition-all',
            mode === 'week' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
          )}
        >
          <CalendarRange className="w-3 h-3" /> Minggu
        </button>
      </div>

      {/* Navigasi */}
      <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg shrink-0" onClick={onBack}>
        <ChevronLeft className="w-3.5 h-3.5" />
      </Button>

      <span className="flex-1 text-center text-xs font-black text-foreground truncate">
        {label}
      </span>

      <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg shrink-0"
        onClick={onForward} disabled={isCurrent}>
        <ChevronRight className="w-3.5 h-3.5" />
      </Button>

      {!isCurrent && (
        <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase px-3 shrink-0"
          onClick={onToday}>
          Kini
        </Button>
      )}
    </div>
  </div>
);

// ── Dashboard utama ───────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user, loading: authLoading } = useAuth() as any;

  // ── Auth & parent status ──────────────────────────────────────────────────
  const [selectedUserId,   setSelectedUserId]   = useState<string | null>(null);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null);
  const [isParent,         setIsParent]         = useState(false);
  const [isReady,          setIsReady]          = useState(false);

  useEffect(() => {
    if (user && !authLoading) {
      setSelectedOfficeId(user.officeId ? String(user.officeId) : '1');
      setSelectedUserId(user.id);
      isParentUser(user.id)
        .then(setIsParent)
        .catch(() => setIsParent(false))
        .finally(() => setIsReady(true));
    }
  }, [user, authLoading]);

  // ── Periode SURAT (terpisah dari agenda) ──────────────────────────────────
  const [suratPeriodMode,   setSuratPeriodMode]   = useState<PeriodMode>('month');
  const [suratAnchor,       setSuratAnchor]       = useState(new Date());

  const suratRange = useMemo(() => getPeriodRange(suratPeriodMode, suratAnchor), [suratPeriodMode, suratAnchor]);
  const suratLabel = useMemo(() => getPeriodLabel(suratPeriodMode, suratAnchor), [suratPeriodMode, suratAnchor]);
  const suratIsCurrent = useMemo(() => isCurrentPeriod(suratPeriodMode, suratAnchor), [suratPeriodMode, suratAnchor]);

  const suratGoBack    = () => setSuratAnchor(prev => suratPeriodMode === 'month' ? subMonths(prev, 1) : subWeeks(prev, 1));
  const suratGoForward = () => setSuratAnchor(prev => suratPeriodMode === 'month' ? addMonths(prev, 1) : addWeeks(prev, 1));
  const suratGoToday   = () => setSuratAnchor(new Date());
  const suratSetMode   = (m: PeriodMode) => { setSuratPeriodMode(m); setSuratAnchor(new Date()); };

  // ── Periode AGENDA (terpisah dari surat) ──────────────────────────────────
  const [agendaPeriodMode, setAgendaPeriodMode] = useState<PeriodMode>('month');
  const [agendaAnchor,     setAgendaAnchor]     = useState(new Date());

  const agendaRange     = useMemo(() => getPeriodRange(agendaPeriodMode, agendaAnchor), [agendaPeriodMode, agendaAnchor]);
  const agendaLabel     = useMemo(() => getPeriodLabel(agendaPeriodMode, agendaAnchor), [agendaPeriodMode, agendaAnchor]);
  const agendaIsCurrent = useMemo(() => isCurrentPeriod(agendaPeriodMode, agendaAnchor), [agendaPeriodMode, agendaAnchor]);

  const agendaGoBack    = () => setAgendaAnchor(prev => agendaPeriodMode === 'month' ? subMonths(prev, 1) : subWeeks(prev, 1));
  const agendaGoForward = () => setAgendaAnchor(prev => agendaPeriodMode === 'month' ? addMonths(prev, 1) : addWeeks(prev, 1));
  const agendaGoToday   = () => setAgendaAnchor(new Date());
  const agendaSetMode   = (m: PeriodMode) => { setAgendaPeriodMode(m); setAgendaAnchor(new Date()); };

  // ── Data fetching AGENDA ──────────────────────────────────────────────────
  const queryBase = {
    enabled: isReady && !!selectedOfficeId,
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev: any) => prev,
  };

  const { data: kpiData = [] } = useQuery({
    queryKey: ['kpi', agendaRange, selectedUserId, selectedOfficeId],
    queryFn: () => getDashboardKPI(agendaRange.start, agendaRange.end, selectedUserId, selectedOfficeId),
    ...queryBase,
  });

  const { data: statusData = [] } = useQuery({
    queryKey: ['status-dist', agendaRange, selectedUserId, selectedOfficeId],
    queryFn: () => getStatusDistribution(agendaRange.start, agendaRange.end, selectedUserId, selectedOfficeId),
    ...queryBase,
  });

  const { data: departmentData = [] } = useQuery({
    queryKey: ['dept-activity', agendaRange, selectedUserId, selectedOfficeId],
    queryFn: () => getDepartmentActivity(agendaRange.start, agendaRange.end, selectedUserId, selectedOfficeId),
    ...queryBase,
  });

  const { data: recentActivities = [] } = useQuery({
    queryKey: ['recent-logs', selectedUserId, selectedOfficeId],
    queryFn: () => getRecentActivities(100, selectedUserId, selectedOfficeId),
    select: (data): ActivityLog[] => {
      if (!Array.isArray(data)) return [];
      return data.map((item: any) => ({
        ...item,
        userId: item.user_id,
        createdAt: item.created_at,
        profiles: item.profiles,
      }));
    },
    ...queryBase,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    enabled: !!user,
  });

  if (authLoading || !isReady) {
    return (
      <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto bg-background min-h-screen">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-card p-6 rounded-2xl border shadow-sm">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tighter uppercase">
            Ringkasan <span className="font-light text-muted-foreground">Data</span>
          </h1>
          <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest italic">
            {selectedOfficeId === '1' ? 'Memantau Seluruh Aktivitas' : `Lokasi: ${user?.officeName}`}
          </p>
        </div>

        {isParent && (
          <div className="min-w-[300px]">
            <AgendaParentFilter
              onUserSelect={setSelectedUserId}
              selectedUserId={selectedUserId}
              onOfficeSelect={setSelectedOfficeId}
              selectedOfficeId={selectedOfficeId}
            />
          </div>
        )}
      </div>

      {/* ── SECTION 1: SURAT ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        <PeriodNav
          title="Statistik Pengajuan Surat"
          icon={<FileText className="w-3 h-3" />}
          accentClass="bg-primary"
          label={suratLabel}
          mode={suratPeriodMode}
          onMode={suratSetMode}
          onBack={suratGoBack}
          onForward={suratGoForward}
          onToday={suratGoToday}
          isCurrent={suratIsCurrent}
        />
        <SuratSummaryCards
          dateFrom={suratRange.start}
          dateTo={suratRange.end}
        />
      </div>

      {/* ── SECTION 2: AGENDA ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <PeriodNav
          title="Statistik Agenda"
          icon={<LayoutList className="w-3 h-3" />}
          accentClass="bg-amber-500"
          label={agendaLabel}
          mode={agendaPeriodMode}
          onMode={agendaSetMode}
          onBack={agendaGoBack}
          onForward={agendaGoForward}
          onToday={agendaGoToday}
          isCurrent={agendaIsCurrent}
        />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {kpiData.map((kpi: any, index: number) => (
            <KPICard key={kpi.label} data={kpi} index={index} />
          ))}
        </div>
      </div>

      {/* ── CHARTS ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <StatusChart data={statusData} />
        <div className="lg:col-span-2">
          <DepartmentChart data={departmentData} />
        </div>
      </div>

      <RecentActivity logs={recentActivities} users={users} />
    </div>
  );
};

export default Dashboard;