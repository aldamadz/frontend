import { supabase } from '@/lib/supabase';

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  // Ambil data tambahan dari tabel profiles jika perlu
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return { ...user, ...profile };
};

export const signOut = async () => {
  await supabase.auth.signOut();
};