import { supabase } from "@/lib/supabase";

export interface Department {
  id: number;
  name: string;
  description?: string;
}

export const getDepartments = async (): Promise<Department[]> => {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error("Error fetching departments:", error);
    return [];
  }

  return data || [];
};