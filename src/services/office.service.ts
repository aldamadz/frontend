// frontend/src/services/office.service.ts
import { supabase } from '@/lib/supabase';
import { Office, OfficeType } from '@/types/office'; 

/**
 * 1. Mengambil semua data kantor yang aktif
 */
export async function getOffices(): Promise<Office[]> {
  const { data, error } = await supabase
    .from('offices')
    .select('*')
    .is('deleted_at', null)
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching offices:', error);
    return [];
  }
  return data || [];
}

/**
 * 2. Mengambil kantor beserta turunannya (Rekursif)
 * Fungsi ini yang menyebabkan error jika tidak di-export
 */
export async function getOfficeWithDescendants(officeId: number): Promise<Office[]> {
  const allOffices = await getOffices();
  const result: Office[] = [];

  // Cari kantor target
  const target = allOffices.find(o => o.id === officeId);
  if (target) result.push(target);

  // Fungsi internal untuk menelusuri anak
  function walk(parentId: number) {
    allOffices
      .filter(o => o.parent_id === parentId)
      .forEach(child => {
        result.push(child);
        walk(child.id); // Rekursi ke bawah
      });
  }

  walk(officeId);
  return result;
}

/**
 * 3. Tambah Kantor Baru
 */
export async function createOffice(payload: { name: string; type: OfficeType; parent_id?: number | null }) {
  const { data, error } = await supabase
    .from('offices')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * 4. Soft Delete Kantor
 */
export async function softDeleteOffice(id: number) {
  const { error } = await supabase
    .from('offices')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
  return true;
}