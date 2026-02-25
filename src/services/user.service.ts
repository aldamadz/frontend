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
    detectSessionInUrl: false
  }
});

/**
 * Helper untuk menangani hasil join Supabase yang sering terbaca sebagai Array oleh TS
 */
const getJoinData = (data: any) => {
  if (Array.isArray(data)) return data[0];
  return data;
};

/**
 * Mengambil semua daftar user
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
      // Perbaikan TS2339: Pastikan kita mengambil objek pertama jika hasil join adalah array
      const dept = getJoinData(item.departments);
      const office = getJoinData(item.offices);

      return {
        ...user,
        email: item.email,
        photoUrl: item.avatar_url || user.photoUrl,
        departmentName: dept?.name || 'UMUM',
        officeName: office?.name || 'PUSAT' 
      };
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

/**
 * Memperbarui data profil
 */
export async function updateUserProfile(userId: string, updates: Partial<User>) {
  try {
    const finalPayload: any = {
      full_name: updates.fullName,
      email: updates.email,
      nik: updates.nik,
      job_title: updates.jobTitle,
      role: updates.role,
      // Perbaikan TS2367: Konversi ke String aman
      office_id: (String(updates.officeId) === "none" || !updates.officeId) ? null : Number(updates.officeId),
      department_id: (String(updates.departmentId) === "none" || !updates.departmentId) ? null : Number(updates.departmentId),
      parent_id: (updates.parentId === "none" || !updates.parentId) ? null : updates.parentId,
      updated_at: new Date().toISOString()
    };

    // Bersihkan properti undefined
    Object.keys(finalPayload).forEach(key => {
      if (finalPayload[key] === undefined) delete finalPayload[key];
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
      const user = toUIUser(item);
      const dept = getJoinData(item.departments);
      const office = getJoinData(item.offices);

      return {
        ...user,
        photoUrl: item.avatar_url || user.photoUrl,
        departmentName: dept?.name || 'UMUM',
        officeName: office?.name || 'PUSAT'
      };
    });
  } catch (error) {
    console.error('Error fetching subordinates:', error);
    return [];
  }
}

/**
 * Mendaftarkan user baru
 */
export const registerNewUser = async (userData: any) => {
  try {
    const { data, error } = await registrationClient.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          full_name: userData.fullName,
          nik: userData.nik,
          job_title: userData.jobTitle,
          role: userData.role || 'user',
          department_id: (userData.departmentId && String(userData.departmentId) !== "none") 
            ? Number(userData.departmentId) 
            : null,
          office_id: (userData.officeId && String(userData.officeId) !== "none") 
            ? Number(userData.officeId) 
            : null,
          parent_id: (userData.parentId && userData.parentId !== "none") 
            ? userData.parentId 
            : null
        }
      }
    });

    if (error) throw error;
    return data.user;
  } catch (error) {
    console.error("Error in registerNewUser service:", error);
    throw error;
  }
};