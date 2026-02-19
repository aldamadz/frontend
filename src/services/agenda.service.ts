// d:/Koding/Agenda Flow/frontend/src/services/agenda.service.ts
import { supabase } from '@/lib/supabase';
import { Agenda, AgendaStatus } from '@/types/agenda';
import { getUserHierarchy } from './parent-user.service'; // Pastikan import ini tersedia

/**
 * Adapter: Mengubah format database (snake_case) ke format aplikasi (camelCase)
 * Menambahkan mapping profil agar UI bisa menampilkan siapa pemilik agendanya
 */
const mapAgenda = (db: any): Agenda => ({
  id: db.id,
  title: db.title,
  description: db.description,
  location: db.location,
  status: db.status as AgendaStatus,
  startTime: db.start_time,
  endTime: db.end_time,
  createdBy: db.created_by,
  createdAt: db.created_at,
  completedAt: db.completed_at,
  deletedAt: db.deleted_at,
  // Mapping join profile (opsional, sesuaikan dengan interface Agenda Anda)
  profiles: db.profiles ? {
    id: db.profiles.id,
    fullName: db.profiles.full_name,
    avatarUrl: db.profiles.avatar_url,
    offices: db.profiles.offices
  } : null
});

/**
 * FUNGSI UTAMA UNTUK ATASAN: Mengambil agenda turunan secara rekursif
 */
export async function getAgendasForParent(
  parentId: string,
  selectedUserId?: string | null,
  officeId?: string | null // Tambahkan ini sebagai argumen ke-3
) {
  try {
    let targetIds: string[];

    // Jika user memilih bawahan spesifik
    if (selectedUserId && selectedUserId !== "all") {
      targetIds = [selectedUserId];
    } else {
      // Ambil seluruh hirarki (Anak, Cucu, dst)
      targetIds = await getUserHierarchy(parentId);
    }

    if (!targetIds || targetIds.length === 0) return [];

    let query = supabase
      .from('agendas')
      .select(`
        *,
        profiles:created_by (
          id, 
          full_name, 
          avatar_url,
          offices:office_id ( name )
        )
      `)
      .in('created_by', targetIds)
      .is('deleted_at', null);

    // Tambahkan filter kantor jika dipilih
    if (officeId && officeId !== 'all') {
      // Karena office_id ada di tabel profiles, kita filter via join
      query = query.filter('profiles.office_id', 'eq', officeId);
    }

    const { data, error } = await query.order('start_time', { ascending: false });
    
    if (error) throw error;
    return (data || []).map(mapAgenda);
  } catch (error) {
    console.error('Error in getAgendasForParent:', error);
    return [];
  }
}
/**
 * Mengambil daftar agenda aktif (User biasa/Personal)
 */
export const getAgendas = async (): Promise<Agenda[]> => {
  const { data, error } = await supabase
    .from('agendas')
    .select('*')
    .is('deleted_at', null)
    .order('start_time', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapAgenda);
};

/**
 * Menyimpan Agenda (Tambah Baru atau Update)
 */
export const saveAgenda = async (
  agendaData: Partial<Agenda> & { startTime?: any; endTime?: any },
  id?: string | number, 
  oldAgenda?: Agenda 
) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi tidak ditemukan.");

  const ensureString = (val: any) => {
    if (!val) return null;
    const date = new Date(val);
    return !isNaN(date.getTime()) ? date.toISOString() : null;
  };

  const payload: any = {
    title: agendaData.title,
    description: agendaData.description,
    location: agendaData.location,
    status: agendaData.status || 'Scheduled',
    start_time: agendaData.startTime ? ensureString(agendaData.startTime) : oldAgenda?.startTime, 
    end_time: agendaData.endTime ? ensureString(agendaData.endTime) : oldAgenda?.endTime,
  };

  if (!id) payload.created_by = user.id;

  if (payload.status === 'Completed') {
    payload.completed_at = new Date().toISOString();
  } else if (agendaData.status) {
    payload.completed_at = null;
  }

  const { data, error } = id 
    ? await supabase.from('agendas').update(payload).eq('id', id).select()
    : await supabase.from('agendas').insert([payload]).select();

  if (error) throw error;
  return mapAgenda(data[0]);
};

export const createAgenda = async (data: Partial<Agenda>) => {
  return await saveAgenda(data as any);
};

export const updateAgenda = async (id: string | number, updates: any) => {
  const { data: oldData } = await supabase
    .from('agendas')
    .select('*')
    .eq('id', id)
    .single();

  const oldAgenda = oldData ? mapAgenda(oldData) : undefined;
  const fullPayload = { ...oldAgenda, ...updates };
  return await saveAgenda(fullPayload, id, oldAgenda);
};

export const updateAgendaStatus = async (id: string | number, status: AgendaStatus, oldAgenda?: Agenda) => {
  return await saveAgenda({ ...oldAgenda, status }, id, oldAgenda);
};

export const deleteAgenda = async (id: string | number) => {
  const { error } = await supabase
    .from('agendas')
    .update({ 
      deleted_at: new Date().toISOString(), 
      status: 'Deleted' 
    })
    .eq('id', id);

  if (error) throw error;
  return true;
};