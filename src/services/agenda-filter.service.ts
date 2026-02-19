import { supabase } from '@/lib/supabase';

/**
 * ADAPTER: Menyamakan database (snake_case) ke UI (camelCase)
 */
const mapAgendaWithProfile = (db: any): any => ({
  id: db.id,
  title: db.title,
  description: db.description,
  location: db.location,
  status: db.status,
  startTime: db.start_time,
  endTime: db.end_time,
  createdBy: db.created_by,
  createdAt: db.created_at,
  completedAt: db.completed_at,
  deletedAt: db.deleted_at,
  profiles: db.profiles ? {
    id: db.profiles.id,
    fullName: db.profiles.full_name,
    nik: db.profiles.nik,
    avatarUrl: db.profiles.avatar_url,
    departments: db.profiles.departments,
    offices: db.profiles.offices
  } : null
});

/**
 * REKURSI AGRESIF: Mengambil semua keturunan (Anak, Cucu, Cicit, dst)
 */
async function getAllSubordinateIds(parentId: string): Promise<string[]> {
  // Ambil semua profil yang aktif
  const { data: allProfiles, error } = await supabase
    .from('profiles')
    .select('id, parent_id, full_name')
    .is('deleted_at', null);

  if (error || !allProfiles) {
    console.error("Gagal mengambil data profil:", error);
    return [parentId];
  }

  const resultIds: string[] = [parentId];
  
  // Fungsi internal untuk menelusuri setiap cabang pohon
  const findChildrenRecursive = (targetId: string) => {
    // Cari semua orang yang parent_id-nya adalah targetId
    const children = allProfiles.filter(p => p.parent_id === targetId);
    
    children.forEach(child => {
      if (!resultIds.includes(child.id)) {
        resultIds.push(child.id);
        // Panggil lagi untuk mencari cucu/cicit (Deep First Search)
        findChildrenRecursive(child.id);
      }
    });
  };

  findChildrenRecursive(parentId);
  
  // Log untuk memastikan ID cucu dan cicit masuk dalam radar
  console.log("🔍 Total Anggota Hirarki:", resultIds.length);
  console.table(allProfiles.filter(p => resultIds.includes(p.id)).map(p => ({ Nama: p.full_name })));
  
  return resultIds;
}

/**
 * FUNGSI UTAMA UNTUK UI
 */
export async function getAgendasForParent(
  parentId: string,
  selectedUserId?: string | null,
  additionalFilters?: any
) {
  try {
    let targetIds: string[];
    
    // Jika dropdown memilih "Semua" atau tidak ada user dipilih, jalankan rekursi
    if (!selectedUserId || selectedUserId === "" || selectedUserId === "all") {
      targetIds = await getAllSubordinateIds(parentId);
    } else {
      targetIds = [selectedUserId];
    }

    if (targetIds.length === 0) return [];

    // Gunakan relasi Opsi A: agendas -> profiles!created_by
    let query = supabase
      .from('agendas')
      .select(`
        *,
        profiles!created_by (
          id, 
          full_name, 
          nik, 
          avatar_url,
          departments:department_id ( id, name ),
          offices:office_id ( id, name )
        )
      `)
      .in('created_by', targetIds)
      .is('deleted_at', null) // Sembunyikan agenda yang sudah dihapus
      .order('start_time', { ascending: false });

    // Terapkan Filter Tambahan jika ada
    if (additionalFilters?.status && additionalFilters.status !== 'all') {
      query = query.eq('status', additionalFilters.status);
    }
    if (additionalFilters?.startDate) {
      query = query.gte('start_time', additionalFilters.startDate);
    }
    if (additionalFilters?.endDate) {
      query = query.lte('end_time', additionalFilters.endDate);
    }
    if (additionalFilters?.departmentId) {
      query = query.eq('profiles.department_id', additionalFilters.departmentId);
    }
    if (additionalFilters?.officeId) {
      query = query.eq('profiles.office_id', additionalFilters.officeId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Mapping kembali ke format CamelCase untuk UI
    return (data || []).map(mapAgendaWithProfile);
  } catch (error) {
    console.error('Error in getAgendasForParent:', error);
    return [];
  }
}

export function groupAgendasByOffice(data: any[]) {
  return data.reduce((acc: Record<string, any[]>, item: any) => {
    // Ambil nama kantor dari hasil join profiles -> offices
    const officeName = item.profiles?.offices?.name || 'KANTOR PUSAT';
    
    if (!acc[officeName]) {
      acc[officeName] = [];
    }
    acc[officeName].push(item);
    return acc;
  }, {});
}