import { supabase } from "@/lib/supabase";

export interface Department {
  id: string;   // uuid — master_departments.id
  name: string;
  code?: string;
}

export const getDepartments = async (): Promise<Department[]> => {
  const { data, error } = await supabase
    .from('master_departments')
    .select('id, name, code')
    .order('name', { ascending: true });

  if (error) {
    console.error("Error fetching departments:", error);
    return [];
  }

  return data || [];
};