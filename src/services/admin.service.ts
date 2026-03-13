import { supabase } from '@/lib/supabase';
import { User } from '@/types/user';
import { Office } from '@/types/office';

export const adminService = {
  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  /**
   * Mengambil semua user yang aktif (deleted_at IS NULL)
   * Dilengkapi dengan data office & master_departments untuk keperluan display
   */
  async getAllUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        offices (id, name),
        master_departments (id, name)
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
    // 1. Destructuring untuk memisahkan data join dari kolom asli
    const { office_id, department_id, offices, master_departments, departments, ...cleanUpdates } = updates as any;

    // 2. Siapkan payload final
    const payload: any = {
      ...cleanUpdates,
      // office_id tetap integer
      office_id: office_id ? Number(office_id) : null,
      // department_id sekarang uuid (string) — FK ke master_departments
      department_id: department_id || null,
      updated_at: new Date().toISOString()
    };

    // 3. Hapus field join yang bukan kolom tabel
    delete payload.offices;
    delete payload.departments;
    delete payload.master_departments;

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

  async createOffice(payload: { name: string; type: string; parent_id?: number | null }) {
    const { data, error } = await supabase
      .from('offices')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async softDeleteOffice(id: number) {
    const { error } = await supabase
      .from('offices')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  // ==========================================
  // DEPARTMENT MANAGEMENT — pakai master_departments
  // ==========================================

  async getAllDepartments() {
    const { data, error } = await supabase
      .from('master_departments')
      .select('id, name, code')
      .order('name', { ascending: true });

    if (error) throw error;
    return data;
  },

  async createDepartment(name: string, code?: string) {
    const { data, error } = await supabase
      .from('master_departments')
      .insert([{ name, ...(code ? { code } : {}) }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteDepartment(id: string) {   // uuid, bukan number
    const { error } = await supabase
      .from('master_departments')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};