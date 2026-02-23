import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY

// Helper untuk menentukan storage mana yang digunakan
const customStorage = {
  getItem: (key: string) => {
    // Cek di localStorage dulu, kalau tidak ada cek di sessionStorage
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    // Jika user mencentang 'remember_me', simpan di localStorage
    // Kita akan set flag 'sb-remember' di LoginPage saat submit
    const shouldRemember = localStorage.getItem('sb-remember') === 'true';
    
    if (shouldRemember) {
      localStorage.setItem(key, value);
    } else {
      sessionStorage.setItem(key, value);
    }
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: customStorage, // Menggunakan proxy storage buatan kita
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
    heartbeatIntervalMs: 15000,
  }
})