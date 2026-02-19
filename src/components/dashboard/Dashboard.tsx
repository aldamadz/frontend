// frontend\src\pages\dashboard\Dashboard.tsx
import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { startOfDay, endOfDay } from 'date-fns';
import { DateRange } from "react-day-picker";
import { cn } from '@/lib/utils';

// Components
import { KPICard } from './KPICard';
import { StatusChart } from './StatusChart';
import { DepartmentChart } from './DepartmentChart';
import { RecentActivity } from './RecentActivity';
import { Skeleton } from '@/components/ui/skeleton';
import { AgendaParentFilter } from '@/components/agenda/AgendaParentFilter'; 
import { SuratSummaryCards } from './SuratSummaryCards'; // <--- IMPORT BARU

// Services
import { 
  getDashboardKPI, 
  getStatusDistribution, 
  getRecentActivities,
  getDepartmentActivity 
} from '@/services/dashboard.service';
import { getUsers, isParentUser } from '@/services';
import { ActivityLog } from '@/types/agenda'; 

// HOOK
import { useAuth } from '@/hooks/use-auth'; 

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth() as any;

  /* ======================================================
      1. FILTER STATES
  ====================================================== */
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY' | 'MONTH' | 'RANGE'>('ALL');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: new Date(), to: new Date() });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null);
  const [isParent, setIsParent] = useState(false);
  const [isReady, setIsReady] = useState(false);

  /* ======================================================
      2. SINKRONISASI DATA USER & PROFILE
  ====================================================== */
  useEffect(() => {
    if (user && !authLoading) {
      const userOffice = user.officeId ? String(user.officeId) : '1';
      setSelectedOfficeId(userOffice);
      setSelectedUserId(user.id);

      const checkParentStatus = async () => {
        try {
          const res = await isParentUser(user.id);
          setIsParent(res);
        } catch (e) {
          console.error("Dashboard error:", e);
        } finally {
          setIsReady(true);
        }
      };
      checkParentStatus();
    }
  }, [user, authLoading]);

  const filterParams = useMemo(() => {
    const now = new Date();
    let start: Date | undefined;
    let end: Date | undefined = endOfDay(now);
    if (timeFilter === 'TODAY') start = startOfDay(now);
    else if (timeFilter === 'MONTH') start = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (timeFilter === 'RANGE' && dateRange?.from && dateRange?.to) {
      start = startOfDay(dateRange.from);
      end = endOfDay(dateRange.to);
    }
    return { start, end };
  }, [timeFilter, dateRange]);

  /* ======================================================
      3. DATA FETCHING (AGENDA)
  ====================================================== */
  const queryOptions = {
    enabled: isReady && !!selectedOfficeId,
    staleTime: 1000 * 60 * 5, 
    placeholderData: (previousData: any) => previousData,
  };

  const { data: kpiData = [] } = useQuery({ 
    queryKey: ['kpi', filterParams, selectedUserId, selectedOfficeId], 
    queryFn: () => getDashboardKPI(filterParams.start, filterParams.end, selectedUserId, selectedOfficeId),
    ...queryOptions
  });

  const { data: statusData = [] } = useQuery({ 
    queryKey: ['status-dist', filterParams, selectedUserId, selectedOfficeId], 
    queryFn: () => getStatusDistribution(filterParams.start, filterParams.end, selectedUserId, selectedOfficeId),
    ...queryOptions
  });

  const { data: departmentData = [] } = useQuery({ 
    queryKey: ['dept-activity', filterParams, selectedUserId, selectedOfficeId], 
    queryFn: () => getDepartmentActivity(filterParams.start, filterParams.end, selectedUserId, selectedOfficeId),
    ...queryOptions
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
        profiles: item.profiles
      }));
    },
    ...queryOptions
  });

  const { data: users = [] } = useQuery({ 
    queryKey: ['users'], 
    queryFn: getUsers, 
    enabled: !!user 
  });

  if (authLoading || !isReady) {
    return (
      <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto bg-background min-h-screen">
      
      {/* HEADER SECTION */}
<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-card p-6 rounded-2xl border shadow-sm">
  <div className="space-y-1">
    <h1 className="text-3xl font-black tracking-tighter uppercase">
      Ringkasan <span className="font-light text-muted-foreground">Data</span>
    </h1>
    <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest italic">
      {selectedOfficeId === '1' ? "Memantau Seluruh Aktivitas" : `Lokasi: ${user?.officeName}`}
    </p>
  </div>

        <div className="flex flex-wrap items-center gap-3">
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
          {/* Time Filters... (Omitted for brevity) */}
        </div>
      </div>

      {/* SECTION 1: SURAT SUMMARY (REALTIME DARI COMPONENT BARU) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-4 w-1 bg-primary rounded-full" />
          <h2 className="text-[11px] font-black uppercase tracking-[0.3em]">Statistik Pengajuan</h2>
        </div>
        <SuratSummaryCards />
      </div>

      {/* SECTION 2: AGENDA KPI */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2">
          <div className="h-4 w-1 bg-amber-500 rounded-full" />
          <h2 className="text-[11px] font-black uppercase tracking-[0.3em]">Statistik Agenda</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {kpiData.map((kpi: any, index: number) => (
            <KPICard key={kpi.label} data={kpi} index={index} />
          ))}
        </div>
      </div>

      {/* CHARTS & RECENT ACTIVITY... */}
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