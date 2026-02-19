// src/types/office.ts
export type OfficeType = 'Pusat' | 'Cabang' | 'KCP';

export interface Office {
  id: number;
  name: string;
  type: OfficeType;
  parent_id: number | null; // Pastikan menggunakan snake_case sesuai DB
  deleted_at: string | null;
  created_at?: string;
}