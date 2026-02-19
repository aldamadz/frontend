import { supabase } from '@/lib/supabase';
import { ActivityLog } from '@/types/agenda';
import { toUIActivityLog } from '@/adapters/activity-log.adapter';

/**
 * Mengambil log aktivitas dengan filter User, Office, dan Pagination.
 * Mendukung fitur Infinite Scroll / Load More.
 */
export const getActivityLogs = async (
  userId?: string | null, 
  officeId?: string | null,
  pageParam: number = 0,
  pageSize: number = 15
): Promise<ActivityLog[]> => {
  // Jika pageSize diatur sangat besar (untuk mode "Semua")
  const actualSize = pageSize;
  const from = pageParam * actualSize;
  const to = from + actualSize - 1;

  let query = supabase
    .from('activity_logs')
    .select(`
      *,
      profiles:user_id (
        full_name,
        avatar_url,
        office_id
      )
    `)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (userId && userId !== 'all' && userId !== 'me') {
    query = query.eq('user_id', userId);
  } else if (userId === 'me') {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) query = query.eq('user_id', user.id);
  }

  if (officeId && officeId !== 'all_offices') {
    query = query.eq('profiles.office_id', officeId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const filteredData = (data || []).filter(log => {
    if (officeId && officeId !== 'all_offices') {
      return log.profiles && (log.profiles as any).office_id === officeId;
    }
    return true;
  });

  return filteredData.map(log => toUIActivityLog(log as any));
};
