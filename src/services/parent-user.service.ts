// src/services/parent-user.service.ts
import { supabase } from '@/lib/supabase';

export interface ChildUser {
  id: string;
  nik: string;
  full_name: string;
  avatar_url: string | null;
  department_id: number | null;
  office_id: number | null;
  parent_id: string | null; // Ditambahkan untuk membantu indentasi di UI
}

/**
 * MENGAMBIL SELURUH HIERARKI USER (Anak, Cucu, Cicit)
 * Fungsi ini digunakan untuk mengisi dropdown filter di UI
 */
export async function getChildUsers(parentId: string): Promise<ChildUser[]> {
  // 1. Ambil SEMUA profil aktif sekali saja (untuk efisiensi)
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, 
      nik, 
      full_name, 
      avatar_url, 
      department_id, 
      office_id, 
      parent_id
    `)
    .is('deleted_at', null)
    .order('full_name', { ascending: true });

  if (error) throw error;
  if (!data) return [];

  const result: any[] = [];

  // 2. Fungsi Rekursif untuk membangun flat list yang terurut secara hirarki
  const findDeep = (currentParentId: string, level: number = 0) => {
    const children = data.filter(p => p.parent_id === currentParentId);
    
    children.forEach(child => {
      // Kita tambahkan properti 'label' dengan spasi untuk indentasi di UI
      result.push({
        ...child,
        displayName: `${"  ".repeat(level)}${level > 0 ? "↳ " : ""}${child.full_name}`,
        depth: level
      });
      
      // Telusuri lebih dalam (Cucu, Cicit, dst)
      findDeep(child.id, level + 1);
    });
  };

  findDeep(parentId);
  return result;
}

/**
 * Mengecek apakah user memiliki bawahan sama sekali
 */
export async function isParentUser(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', userId)
    .is('deleted_at', null);

  if (error) {
    console.error('Error checking parent status:', error);
    return false;
  }

  return (count || 0) > 0;
}

/**
 * Mengambil hanya daftar ID (String Array) untuk keperluan query SQL .in()
 */
export async function getUserHierarchy(parentId: string): Promise<string[]> {
  const { data: allProfiles, error } = await supabase
    .from('profiles')
    .select('id, parent_id')
    .is('deleted_at', null);

  if (error || !allProfiles) return [parentId];

  const allSubordinateIds: string[] = [parentId];

  const findChildrenRecursive = (currentId: string) => {
    const children = allProfiles.filter(p => p.parent_id === currentId);
    children.forEach(child => {
      if (!allSubordinateIds.includes(child.id)) {
        allSubordinateIds.push(child.id);
        findChildrenRecursive(child.id);
      }
    });
  };

  findChildrenRecursive(parentId);
  return allSubordinateIds;
}