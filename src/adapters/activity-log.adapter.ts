// frontend/src/adapters/activity-log.adapter.ts
import type { ActivityLog as UILog } from '@/types/agenda';

export function toUIActivityLog(log: any): UILog {
  return {
    id: String(log.id),
    
    // Mapping dari snake_case (DB) ke camelCase (UI)
    userId: log.user_id || log.userId,
    action: log.action || 'UNKNOWN',
    tableName: log.table_name || log.tableName || '',
    recordId: String(log.record_id || log.recordId || ''),
    
    // Values
    newValues: log.new_values ?? log.newValues ?? undefined,
    oldValues: log.old_values ?? log.oldValues ?? undefined,
    
    // Time
    createdAt: log.created_at || log.createdAt || new Date().toISOString(),
    details: log.details,

    // Mapping Nested Object Profile (Kunci perbaikan error ada di sini)
    profiles: log.profiles ? {
      fullName: log.profiles.full_name || log.profiles.fullName || 'Sistem',
      avatarUrl: log.profiles.avatar_url || log.profiles.avatarUrl || undefined
    } : null
  };
}