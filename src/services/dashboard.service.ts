// frontend/src/services/dashboard.service.ts
import { supabase } from '@/lib/supabase';
import type { 
  DepartmentActivity, 
  KPIData,
  StatusChartData
} from '@/types/dashboard';
import { getUserHierarchy } from './parent-user.service';

/**
 * 1. Mapping Nama Departemen ke Singkatan
 */
function shortenDeptName(deptName: string): string {
  const map: Record<string, string> = {
    'Pengembangan Organisasi': 'PO',
    'HR & GA': 'HRGA',
    'Finance & Accounting': 'Keuangan',
    'Marketing': 'Marketing',
    'Business Development': 'BD',
    'Legal Lahan': 'Legal Lahan',
    'Legal Proyek & Humas': 'Legal Proyek',
    'Purchasing': 'Purchasing',
    'Perencanaan': 'Perencanaan',
    'UMUM': 'Umum'
  };
  return map[deptName] || deptName;
}

/**
 * 2. Helper Resolving Target IDs
 * Menangani string 'all' dari UI agar tidak menyebabkan error UUID di PostgreSQL
 */
async function resolveTargetIds(
  currentUserId: string,
  selectedUserId?: string | null
): Promise<string[]> {
  // Jika filter 'Semua Anggota' atau kosong
  if (!selectedUserId || selectedUserId === 'all') {
    return await getUserHierarchy(currentUserId);
  }

  // Jika memilih ID spesifik (termasuk diri sendiri)
  return [selectedUserId];
}

/**
 * 3. Helper Internal Fetch Agendas
 */
async function fetchAgendasInternal(targetUserIds: string[], startDate?: Date, endDate?: Date) {
  if (!targetUserIds || targetUserIds.length === 0) return { data: [], error: null };

  let query = supabase
    .from('agendas')
    .select('status, created_by, end_time, start_time')
    .is('deleted_at', null)
    .in('created_by', targetUserIds);

  if (startDate) query = query.gte('start_time', startDate.toISOString());
  if (endDate) {
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    query = query.lte('start_time', endOfDay.toISOString());
  }

  return await query;
}

/**
 * 4. Stats Ringkasan (Base Logic)
 */
export async function getDashboardStats(
  startDate?: Date, 
  endDate?: Date, 
  userId?: string | null,
  officeId?: string | null | number
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return emptyStats();

    const targetUserIds = await resolveTargetIds(user.id, userId);
    const { data: agendas, error } = await fetchAgendasInternal(targetUserIds, startDate, endDate);
    
    if (error) throw error;
    const safeAgendas = agendas || [];
    const now = new Date();

    // Mapping Status yang lebih luas agar tidak ada data yang terlewat
    return {
      total: safeAgendas.length,
      completed: safeAgendas.filter(a => 
        ['Completed', 'Selesai', 'Success'].includes(a.status)
      ).length,
      ongoing: safeAgendas.filter(a => 
        ['Ongoing', 'Proses', 'In Progress', 'Berjalan'].includes(a.status)
      ).length,
      scheduled: safeAgendas.filter(a => 
        ['Scheduled', 'Pending', 'Rencana', 'Belum Mulai'].includes(a.status)
      ).length,
      overdue: safeAgendas.filter(a => {
        const isPastDue = a.end_time && new Date(a.end_time) < now;
        return !['Completed', 'Selesai'].includes(a.status) && isPastDue;
      }).length,
    };
  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    return emptyStats();
  }
}

/**
 * 5. Mengambil aktivitas per Departemen (Bar Chart)
 */
export async function getDepartmentActivity(
  startDate?: Date, 
  endDate?: Date, 
  userId?: string | null,
  officeId?: string | null | number
): Promise<DepartmentActivity[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // 1. Ambil SEMUA Departemen dari database sebagai master list
    const { data: allDepartments } = await supabase
      .from('departments')
      .select('name')
      .order('name');

    if (!allDepartments) return [];

    // 2. Inisialisasi Grouped Object dengan nilai 0 untuk SEMUA departemen
    const grouped: Record<string, { tasks: number; completed: number }> = {};
    allDepartments.forEach(dept => {
      grouped[dept.name] = { tasks: 0, completed: 0 };
    });

    // 3. Tentukan target IDs (Hirarki atau Spesifik)
    const targetIds = await resolveTargetIds(user.id, userId);
    
    // 4. Ambil data agenda
    const { data: agendas } = await fetchAgendasInternal(targetIds, startDate, endDate);
    
    // 5. Ambil profil untuk mapping ke departemen
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, departments(name)')
      .in('id', targetIds);

    // 6. Masukkan data agenda ke dalam master list yang sudah diinisialisasi
    if (agendas) {
      agendas.forEach(agenda => {
        const profile = profiles?.find(p => p.id === agenda.created_by);
        const deptName = (profile?.departments as any)?.name;

        // Pastikan deptName ada di list master kita
        if (deptName && grouped[deptName] !== undefined) {
          grouped[deptName].tasks++;
          if (['Completed', 'Selesai'].includes(agenda.status)) {
            grouped[deptName].completed++;
          }
        }
      });
    }

    // 7. Filter Kantor (Opsional, jika ingin membatasi tampilan divisi tertentu di cabang)
    const isPusat = !officeId || String(officeId) === '1' || officeId === 'all_offices';

    return Object.entries(grouped)
      .map(([fullName, data]) => ({
        name: shortenDeptName(fullName),
        fullName: fullName,
        tasks: data.tasks,
        completed: data.completed,
      }))
      // Jika di pusat, tampilkan SEMUA. Jika di cabang, filter divisi tertentu saja.
      .filter(item => isPusat || ['Marketing', 'Perencanaan', 'Umum'].includes(item.fullName));

  } catch (error) {
    console.error("Dept Activity Error:", error);
    return [];
  }
}

/**
 * 6. Data KPI
 */
export async function getDashboardKPI(
  startDate?: Date, endDate?: Date, userId?: string | null, officeId?: string | null
): Promise<KPIData[]> {
  const stats = await getDashboardStats(startDate, endDate, userId, officeId);
  const total = stats.total || 0;
  const getRate = (val: number) => (total > 0 ? Math.round((val / total) * 100) : 0);

  return [
    { label: 'Total Agenda', value: total, change: 0, trend: 'neutral' },
    { label: 'Completed', value: stats.completed, change: getRate(stats.completed), trend: 'up' },
    { label: 'Ongoing', value: stats.ongoing, change: getRate(stats.ongoing), trend: 'up' },
    { label: 'Scheduled', value: stats.scheduled, change: getRate(stats.scheduled), trend: 'neutral' },
    { label: 'Overdue', value: stats.overdue, change: getRate(stats.overdue), trend: 'down' }
  ];
}

/**
 * 7. Status Distribution (Pie Chart) - FIXED: Tidak akan hilang jika data 0
 */
export async function getStatusDistribution(
  startDate?: Date, endDate?: Date, userId?: string | null, officeId?: string | null
): Promise<StatusChartData[]> {
  const stats = await getDashboardStats(startDate, endDate, userId, officeId);
  
  const rawData = [
    { name: 'Completed', value: stats.completed },
    { name: 'Ongoing', value: stats.ongoing },
    { name: 'Scheduled', value: stats.scheduled },
    { name: 'Overdue', value: stats.overdue },
  ];

  // Kembalikan semua data meskipun 0, agar komponen Recharts tetap memiliki struktur array
  // Filter hanya dilakukan jika ada minimal satu data yang tidak 0, 
  // atau biarkan apa adanya agar chart menampilkan state "No Data".
  const hasAnyData = rawData.some(d => d.value > 0);
  
  return hasAnyData ? rawData.filter(d => d.value > 0) : rawData;
}

/**
 * 8. Recent Activities
 */
export async function getRecentActivities(
  limit = 10, userId?: string | null, officeId?: string | null
): Promise<any[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const targetUserIds = await resolveTargetIds(user.id, userId);
    
    const { data, error } = await supabase
      .from('activity_logs')
      .select(`*, profiles:user_id ( id, full_name, avatar_url )`)
      .in('user_id', targetUserIds) 
      .order('created_at', { ascending: false })
      .limit(limit);

    return error ? [] : data || [];
  } catch (error) {
    return [];
  }
}

function emptyStats() {
  return { total: 0, completed: 0, ongoing: 0, scheduled: 0, overdue: 0 };
}