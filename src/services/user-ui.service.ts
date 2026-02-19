import { supabase } from '@/lib/supabase'
import { User } from '@/types/agenda'
import { toUIUser } from '@/adapters/user.adapter'

/**
 * MENGAMBIL PROFIL USER YANG SEDANG LOGIN
 */
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) return null;

    // Ambil data profil lengkap
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(`
        *,
        departments (name)
      `)
      .eq('id', authUser.id)
      .maybeSingle();

    if (error || !profile) return null;

    // 1. Gunakan adapter bawaan
    const uiUser = toUIUser(profile);
    
    // 2. Return dengan mapping manual untuk menjamin sinkronisasi avatar_url
    return {
      ...uiUser,
      email: authUser.email || uiUser.email,
      // Pastikan photoUrl terisi dari avatar_url database
      photoUrl: profile.avatar_url || uiUser.photoUrl || null,
      departmentName: profile.departments?.name || 'Umum'
    };
  } catch (error) {
    console.error('Error fetching current profile:', error);
    return null;
  }
}