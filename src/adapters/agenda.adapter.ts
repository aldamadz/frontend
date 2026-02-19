// frontend/src/adapters/agenda.adapter.ts
import { Agenda, AgendaStatus } from '@/types/agenda';

/**
 * Mengubah data dari public.agendas (PostgreSQL) ke Interface Agenda (Frontend)
 */
export function toUIAgenda(data: any): Agenda {
  return {
    // ID di skema kamu adalah serial (number)
    id: data.id,
    title: data.title || 'Tanpa Judul',
    description: data.description || '',
    location: data.location || '',
    
    // Status menggunakan enum custom agenda_status
    status: (data.status as AgendaStatus) || 'Scheduled',
    
    // Pemetaan snake_case ke camelCase sesuai skema SQL
    startTime: data.start_time || data.startTime,
    endTime: data.end_time || data.endTime,
    
    // created_by adalah UUID yang mereferensi ke auth.users
    createdBy: data.created_by || data.createdBy,
    
    // Timestamps dengan format Time Zone
    completedAt: data.completed_at || data.completedAt || null,
    deletedAt: data.deleted_at || data.deletedAt || null,
    createdAt: data.created_at || data.createdAt,
    
    // Note: Di skema SQL kamu tidak ada updated_at, 
    // tapi kita jaga-jaga jika nanti kamu menambahkannya
    updatedAt: data.updated_at || data.updatedAt,
  };
}

/**
 * Mengubah data dari Frontend ke format yang siap di-insert/update ke database
 */
export function toDatabaseAgenda(agenda: Partial<Agenda>) {
  const dbData: any = {
    title: agenda.title,
    description: agenda.description,
    location: agenda.location,
    status: agenda.status,
    start_time: agenda.startTime,
    end_time: agenda.endTime,
    created_by: agenda.createdBy,
    completed_at: agenda.completedAt,
    deleted_at: agenda.deletedAt,
  };

  // Menghapus key yang nilainya undefined agar tidak mengacaukan query
  Object.keys(dbData).forEach(key => dbData[key] === undefined && delete dbData[key]);
  
  return dbData;
}