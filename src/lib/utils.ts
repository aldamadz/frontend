import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Agenda, AgendaStatus } from "@/types/agenda"
import { isBefore, isAfter, addMinutes } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Logika Penentuan Status Otomatis berdasarkan Waktu
 */
export const getAutomaticStatus = (agenda: Agenda): AgendaStatus => {
  // Jika status sudah final (Selesai atau Dihapus), jangan ubah lagi secara otomatis
  if (agenda.status === 'Completed' || agenda.status === 'Deleted') {
    return agenda.status;
  }

  const now = new Date();
  const startTime = new Date(agenda.startTime);
  
  // Jika endTime tidak ada, kita asumsikan durasi agenda adalah 60 menit
  const endTime = agenda.endTime 
    ? new Date(agenda.endTime) 
    : addMinutes(startTime, 60);

  // 1. OVERDUE: Sekarang sudah melewati waktu selesai
  if (isAfter(now, endTime)) {
    return 'Overdue';
  }

  // 2. ONGOING: Sekarang berada di antara waktu mulai dan selesai
  if (isAfter(now, startTime) && isBefore(now, endTime)) {
    return 'Ongoing';
  }

  // 3. SCHEDULED: Waktu mulai masih di masa depan
  return 'Scheduled';
};