// D:/Koding/Agenda Flow/frontend/src/services/user.service.ts
import { createClient } from '@supabase/supabase-js'; 
import { supabase } from '@/lib/supabase';
import type { User } from '@/types/agenda';
import { toUIUser } from '@/adapters/user.adapter';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

/**
 * INSTANCE KHUSUS REGISTRASI
 * Digunakan agar saat mendaftarkan user baru, session Admin tidak tertimpa.
 * persistSession: false memastikan token user baru tidak disimpan ke localStorage.
 */
const registrationClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

/**
 * Mengambil semua daftar user dengan join ke tabel departments dan offices.
 */
export async function getUsers(): Promise<User[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        departments ( name ),
        offices ( name )
      `)
      .order('full_name', { ascending: true });

    if (error) throw error;

    return (data || []).map(item => {
      const user = toUIUser(item);
      return {
        ...user,
        photoUrl: item.avatar_url || user.photoUrl,
        departmentName: item.departments?.name || 'UMUM',
        officeName: item.offices?.name || 'PUSAT' 
      };
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

/**
 * Memperbarui data profil (Role, Atasan, atau Departemen).
 */
export async function updateUserProfile(userId: string, updates: any) {
  try {
    const finalPayload: any = {
      full_name: updates.fullName || updates.full_name,
      nik: updates.nik,
      job_title: updates.jobTitle || updates.job_title,
      role: updates.role,
      office_id: updates.officeId !== undefined ? updates.officeId : undefined,
      department_id: updates.departmentId !== undefined ? updates.departmentId : undefined,
      // Perbaikan Krusial: Pastikan null dikirim jika "none"
      parent_id: (updates.parentId === "none" || !updates.parentId) ? null : updates.parentId,
      updated_at: new Date().toISOString()
    };

    // Hanya hapus yang benar-benar tidak dikirim (undefined)
    // Jangan hapus yang bernilai null (karena null digunakan untuk mengosongkan atasan)
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
 * Mengambil daftar bawahan langsung (one-level) berdasarkan parentId.
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
        return {
            ...user,
            photoUrl: item.avatar_url || user.photoUrl,
            departmentName: item.departments?.name,
            officeName: item.offices?.name || 'PUSAT'
        };
    });
  } catch (error) {
    console.error('Error fetching subordinates:', error);
    return [];
  }
}

/**
 * Mendaftarkan user baru TANPA mengeluarkan session Admin yang sedang login.
 * Menggunakan Trigger 'handle_new_user' di sisi database untuk mengisi tabel profiles.
 */
export const registerNewUser = async (userData: any) => {
  try {
    // Kita gunakan registrationClient agar session Admin tidak tertukar (persistSession: false)
    const { data, error } = await registrationClient.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          full_name: userData.fullName || userData.full_name,
          nik: userData.nik,
          job_title: userData.jobTitle || userData.job_title,
          role: userData.role || 'user',
          department_id: userData.departmentId ? Number(userData.departmentId) : null,
          office_id: userData.officeId ? Number(userData.officeId) : null,
          parent_id: (userData.parentId && userData.parentId !== "none") ? userData.parentId : null
        }
      }
    });

    if (error) throw error;
    
    console.log("Registrasi berhasil, profil akan dibuat otomatis oleh trigger database.");
    return data.user;
  } catch (error) {
    console.error("Error in registerNewUser service:", error);
    throw error;
  }
};