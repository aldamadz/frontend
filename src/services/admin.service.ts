import { supabase } from '@/lib/supabase';
import { User } from '@/types/user';
import { Office } from '@/types/office';

export const adminService = {
  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  /**
   * Mengambil semua user yang aktif (deleted_at IS NULL)
   * Dilengkapi dengan data office untuk keperluan display
   */
  async getAllUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        offices (id, name),
        departments (id, name)
      `)
      .is('deleted_at', null)
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data;
  },

  /**
   * Update profile user (Office, Dept, Parent, Role, dll)
   */
async updateUserProfile(userId: string, updates: Partial<User>) {
    // 1. Destructuring untuk memisahkan data
    // Kita ambil field-field yang berpotensi menyebabkan error tipe data
    const { office_id, department_id, offices, departments, ...cleanUpdates } = updates as any;

    // 2. Siapkan payload final
    const payload: any = {
      ...cleanUpdates,
      // Pastikan office_id & department_id adalah Integer (angka)
      // Jika kosong atau string kosong, set jadi null
      office_id: office_id ? Number(office_id) : null,
      department_id: department_id ? Number(department_id) : null,
      updated_at: new Date().toISOString()
    };

    // 3. Proteksi: Hapus field yang bukan kolom tabel (seperti data joinan dari query select)
    // Seringkali objek user membawa data 'offices' atau 'departments' hasil join
    // Jika ini dikirim balik ke .update(), Supabase akan error karena kolom itu tidak ada
    delete payload.offices;
    delete payload.departments;

    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error("Payload yang menyebabkan error:", payload);
      throw error;
    }
    return data;
  },

  /**
   * Soft delete user agar tidak bisa login namun history tetap ada
   */
  async softDeleteUser(userId: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;
  },

  // ==========================================
  // OFFICE MANAGEMENT (Skema: public.offices)
  // ==========================================

  /**
   * Tambah kantor baru sesuai skema enum office_type
   */
  async createOffice(payload: { name: string; type: string; parent_id?: number | null }) {
    const { data, error } = await supabase
      .from('offices')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Soft delete office sesuai kolom deleted_at
   */
  async softDeleteOffice(id: number) {
    const { error } = await supabase
      .from('offices')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  // ==========================================
  // DEPARTMENT MANAGEMENT
  // ==========================================

  async getAllDepartments() {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data;
  },

  async createDepartment(name: string) {
    const { data, error } = await supabase
      .from('departments')
      .insert([{ name }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteDepartment(id: number) {
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};