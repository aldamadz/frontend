// frontend/src/services/user.service.ts
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types/agenda';
import { toUIUser } from '@/adapters/user.adapter';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

/**
 * INSTANCE KHUSUS REGISTRASI
 */
const registrationClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

/**
 * Helper untuk menangani hasil join Supabase yang sering terbaca sebagai Array oleh TS
 */
const getJoinData = (data: any) => {
  if (Array.isArray(data)) return data[0];
  return data;
};

/**
 * Mengambil semua daftar user — termasuk phone, join_date, resign_date, is_active
 */
export async function getUsers(): Promise<User[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        nik,
        job_title,
        role,
        avatar_url,
        phone,
        join_date,
        resign_date,
        is_active,
        office_id,
        department_id,
        parent_id,
        departments ( name ),
        offices ( name )
      `)
      .order('full_name', { ascending: true });

    if (error) throw error;

    return (data || []).map(item => {
      const user = toUIUser(item);
      const dept   = getJoinData(item.departments);
      const office = getJoinData(item.offices);

      return {
        ...user,
        email:          item.email,
        photoUrl:       item.avatar_url || user.photoUrl,
        departmentName: dept?.name   || 'UMUM',
        officeName:     office?.name || 'PUSAT',
        // ── field tambahan yang perlu tersedia di UserManagementPage ──
        phone:          item.phone       ?? null,
        join_date:      item.join_date   ?? null,
        resign_date:    item.resign_date ?? null,
        is_active:      item.is_active   ?? true,
      } as User & {
        phone: string | null;
        join_date: string | null;
        resign_date: string | null;
        is_active: boolean;
      };
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

/**
 * Memperbarui data profil — support penuh semua field karyawan
 */
export async function updateUserProfile(userId: string, updates: Partial<User> & {
  phone?:       string | null;
  join_date?:   string | null;
  resign_date?: string | null;
}) {
  try {
    const finalPayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // ── Mapping camelCase (UI) → snake_case (DB) ─────────────────────────
    if (updates.fullName     !== undefined) finalPayload.full_name     = updates.fullName;
    if (updates.email        !== undefined) finalPayload.email         = updates.email;
    if (updates.nik          !== undefined) finalPayload.nik           = updates.nik;
    if (updates.jobTitle     !== undefined) finalPayload.job_title     = updates.jobTitle;
    if (updates.role         !== undefined) finalPayload.role          = updates.role;

    // Field tambahan
    if (updates.phone        !== undefined) finalPayload.phone         = updates.phone       || null;
    if (updates.join_date    !== undefined) finalPayload.join_date     = updates.join_date   || null;
    if (updates.resign_date  !== undefined) finalPayload.resign_date   = updates.resign_date || null;

    // Relasi
    if (updates.officeId !== undefined) {
      finalPayload.office_id = (String(updates.officeId) === 'none' || !updates.officeId)
        ? null : Number(updates.officeId);
    }
    if (updates.departmentId !== undefined) {
      finalPayload.department_id = (String(updates.departmentId) === 'none' || !updates.departmentId)
        ? null : Number(updates.departmentId);
    }
    if (updates.parentId !== undefined) {
      finalPayload.parent_id = (updates.parentId === 'none' || !updates.parentId)
        ? null : updates.parentId;
    }

    // Bersihkan undefined
    Object.keys(finalPayload).forEach(k => {
      if (finalPayload[k] === undefined) delete finalPayload[k];
    });

    const { data, error } = await supabase
      .from('profiles')
      .update(finalPayload)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw error;
  }
}

/**
 * Mengambil daftar bawahan
 */
export async function getSubordinates(parentId: string): Promise<User[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, departments(name), offices(name)')
      .eq('parent_id', parentId);

    if (error) throw error;

    return (data || []).map(item => {
      const user   = toUIUser(item);
      const dept   = getJoinData(item.departments);
      const office = getJoinData(item.offices);

      return {
        ...user,
        photoUrl:       item.avatar_url || user.photoUrl,
        departmentName: dept?.name   || 'UMUM',
        officeName:     office?.name || 'PUSAT',
      };
    });
  } catch (error) {
    console.error('Error fetching subordinates:', error);
    return [];
  }
}

/**
 * Mendaftarkan user baru (flow lama via registrationClient, tetap dipertahankan)
 */
export const registerNewUser = async (userData: any) => {
  try {
    const { data, error } = await registrationClient.auth.signUp({
      email:    userData.email,
      password: userData.password,
      options: {
        data: {
          full_name:     userData.fullName,
          nik:           userData.nik,
          job_title:     userData.jobTitle,
          role:          userData.role || 'user',
          department_id: (userData.departmentId && String(userData.departmentId) !== 'none')
            ? Number(userData.departmentId) : null,
          office_id:     (userData.officeId && String(userData.officeId) !== 'none')
            ? Number(userData.officeId) : null,
          parent_id:     (userData.parentId && userData.parentId !== 'none')
            ? userData.parentId : null,
        },
      },
    });

    if (error) throw error;
    return data.user;
  } catch (error) {
    console.error('Error in registerNewUser service:', error);
    throw error;
  }
};