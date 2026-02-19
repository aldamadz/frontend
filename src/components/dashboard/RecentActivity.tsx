// frontend\src\components\dashboard\RecentActivity.tsx
import { useState, useMemo } from 'react';
import { format, formatDistanceToNow, isValid } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { 
  FileEdit, Plus, LogIn, Trash2, History, 
  User as UserIcon, Calendar, CheckCircle, Search 
} from 'lucide-react';
import { ActivityLog, User, ActivityAction } from '@/types/agenda';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface RecentActivityProps {
  logs: ActivityLog[];
  users: User[];
}

// --- Konfigurasi Visual ---
const actionConfigs: Record<string, { icon: any; color: string; header: string; label: string }> = {
  CREATE: { icon: Plus, label: 'Membuat', color: 'text-emerald-600 bg-emerald-500/10', header: 'bg-emerald-600' },
  INSERT: { icon: Plus, label: 'Membuat', color: 'text-emerald-600 bg-emerald-500/10', header: 'bg-emerald-600' },
  UPDATE: { icon: FileEdit, label: 'Memperbarui', color: 'text-blue-600 bg-blue-500/10', header: 'bg-blue-600' },
  DELETE: { icon: Trash2, label: 'Menghapus', color: 'text-rose-600 bg-rose-500/10', header: 'bg-rose-600' },
  LOGIN:  { icon: LogIn, label: 'Masuk', color: 'text-amber-600 bg-amber-500/10', header: 'bg-amber-600' },
};

// --- Utils ---
const formatValue = (key: string, val: any) => {
  if (val === null || val === undefined) return 'Kosong';
  const strVal = String(val);
  const isTime = /time|date|at/i.test(key) || /^\d{4}-\d{2}-\d{2}T/.test(strVal);
  
  if (isTime && isValid(new Date(strVal))) {
    return format(new Date(strVal), "dd MMM yyyy, HH:mm", { locale: localeID });
  }
  return strVal;
};

// --- Komponen Utama ---
export const RecentActivity = ({ logs = [], users = [] }: RecentActivityProps) => {
  const [activeFilter, setActiveFilter] = useState<ActivityAction | 'ALL'>('ALL');
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const filteredLogs = useMemo(() => {
    const safeLogs = Array.isArray(logs) ? logs : [];
    return activeFilter === 'ALL' 
      ? safeLogs 
      : safeLogs.filter(l => l.action?.toUpperCase() === activeFilter);
  }, [logs, activeFilter]);

  const getActorInfo = (log: ActivityLog) => {
    const profile = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles;
    const user = users.find(u => String(u.id) === String(log.userId || (log as any).user_id));
    return {
      name: profile?.fullName || profile?.full_name || user?.fullName || 'Sistem',
      avatar: profile?.avatarUrl || (user as any)?.photoUrl
    };
  };

  const getDisplayMessage = (log: ActivityLog) => {
    const oldData = log.oldValues || (log as any).old_values || {};
    const newData = log.newValues || (log as any).new_values || {};
    const title = newData.title || oldData.title || newData.full_name || oldData.full_name || "";
    
    const tableMapping: Record<string, string> = { agendas: 'agenda', profiles: 'profil' };
    const rawTable = log.tableName || (log as any).table_name || "";
    const entityName = tableMapping[rawTable] || (rawTable ? rawTable.toLowerCase().replace(/s$/, '') : 'agenda');

    // DETEKSI SOFT DELETE (Update status ke Deleted)
    const isSoftDelete = log.action?.toUpperCase() === 'UPDATE' && 
                        (newData.status === 'Deleted' || (newData.deleted_at && !oldData.deleted_at));

    if (isSoftDelete) return `menghapus ${entityName} "${title}"`;

    if (log.action?.toUpperCase() === 'UPDATE') {
      if (newData.status && oldData.status && newData.status !== oldData.status) {
        return `mengubah status ${entityName} "${title}" menjadi ${newData.status}`;
      }
      if (newData.location && oldData.location && newData.location !== oldData.location) {
        return `memindahkan lokasi ${entityName} "${title}" ke ${newData.location}`;
      }
      if (newData.start_time && oldData.start_time && newData.start_time !== oldData.start_time) {
        return `menjadwal ulang ${entityName} "${title}"`;
      }
      return `memperbarui informasi ${entityName} "${title}"`;
    }

    const config = actionConfigs[log.action?.toUpperCase()] || actionConfigs.UPDATE;
    return `${config.label.toLowerCase()} ${entityName} ${title ? `"${title}"` : ''}`;
  };

  const renderDiff = (log: ActivityLog) => {
    const oldVal = log.oldValues || (log as any).old_values || {};
    const newVal = log.newValues || (log as any).new_values || {};
    const keys = Object.keys(log.action === 'DELETE' || (newVal.status === 'Deleted') ? oldVal : newVal)
      .filter(k => !['id', 'user_id', 'created_at', 'updated_at', 'deleted_at'].includes(k));

    return (
      <div className="space-y-4 py-2">
        {keys.map(key => (
          <div key={key} className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-primary" /> {key.replace(/_/g, ' ')}
            </label>
            <div className="p-3 rounded-xl bg-muted/50 border border-border/50 text-sm">
              {log.action === 'UPDATE' && oldVal[key] !== newVal[key] ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="line-through opacity-40 italic">{formatValue(key, oldVal[key])}</div>
                  <div className="font-bold text-emerald-600">{formatValue(key, newVal[key])}</div>
                </div>
              ) : (
                <div className="font-semibold">{formatValue(key, newVal[key] || oldVal[key])}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col h-full">
        <div className="p-6 border-b bg-muted/20 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <History className="w-5 h-5 text-primary" />
            <h3 className="font-bold">Aktivitas Terbaru</h3>
          </div>
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            {['ALL', 'CREATE', 'UPDATE', 'DELETE'].map((f) => (
              <button 
                key={f} 
                onClick={() => setActiveFilter(f as any)}
                className={cn(
                  "px-3 py-1 text-[10px] font-bold rounded-md transition-all uppercase", 
                  activeFilter === f ? "bg-background shadow-sm text-primary" : "text-muted-foreground"
                )}
              >
                {f === 'ALL' ? 'Semua' : f}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[500px] space-y-4 scrollbar-thin">
          {filteredLogs.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm italic">Belum ada aktivitas.</div>
          ) : (
            filteredLogs.map((log, i) => {
              const oldData = log.oldValues || (log as any).old_values || {};
              const newData = log.newValues || (log as any).new_values || {};
              
              // HIJACK LOGIC: Jika status jadi Deleted, paksa pakai config DELETE
              const isSoftDelete = log.action?.toUpperCase() === 'UPDATE' && 
                                  (newData.status === 'Deleted' || (newData.deleted_at && !oldData.deleted_at));
              
              const actionKey = isSoftDelete ? 'DELETE' : log.action?.toUpperCase();
              const config = actionConfigs[actionKey] || actionConfigs.UPDATE;
              
              const actor = getActorInfo(log);
              return (
                <div 
                  key={i} 
                  onClick={() => setSelectedLog(log)}
                  className="flex items-start gap-4 p-3 hover:bg-muted/50 rounded-xl cursor-pointer transition-all group border border-transparent hover:border-border/50"
                >
                  <div className={cn("p-2 rounded-lg shrink-0 shadow-sm transition-colors", config.color)}>
                    <config.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed">
                      <span className="font-bold text-foreground">{actor.name}</span> 
                      <span className="text-muted-foreground"> {getDisplayMessage(log)}</span>
                    </p>
                    <span className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-tighter">
                      {log.createdAt && formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: localeID })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
          {selectedLog && (() => {
             const newData = selectedLog.newValues || (selectedLog as any).new_values || {};
             const isSoftDelete = selectedLog.action?.toUpperCase() === 'UPDATE' && newData.status === 'Deleted';
             const modalConfig = actionConfigs[isSoftDelete ? 'DELETE' : selectedLog.action?.toUpperCase()] || actionConfigs.UPDATE;
             
             return (
              <div className="flex flex-col">
                <div className={cn("p-8 text-white relative transition-colors", modalConfig.header)}>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2">Log Explorer</p>
                  <h2 className="text-xl font-black leading-tight">
                    {getDisplayMessage(selectedLog)}
                  </h2>
                </div>
                <div className="p-8 max-h-[60vh] overflow-y-auto scrollbar-thin bg-background">
                  {renderDiff(selectedLog)}
                </div>
                <div className="p-4 bg-muted/30 border-t flex justify-end">
                  <button 
                    onClick={() => setSelectedLog(null)}
                    className="px-6 py-2 bg-foreground text-background text-[10px] font-bold uppercase rounded-xl hover:bg-foreground/90 transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </div>
             )
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
};

// --- Komponen Tabel (ActivityLogsView) ---
export const ActivityLogsView = ({ logs = [], users = [], currentUser }: any) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="p-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-20 text-center">Aksi</th>
            <th className="p-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pelaku</th>
            <th className="p-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Keterangan</th>
            <th className="p-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Waktu</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {logs.map((log: any, i: number) => {
            const newData = log.newValues || log.new_values || {};
            const isSoftDelete = log.action?.toUpperCase() === 'UPDATE' && newData.status === 'Deleted';
            const config = actionConfigs[isSoftDelete ? 'DELETE' : log.action?.toUpperCase()] || actionConfigs.UPDATE;
            
            const actorId = log.userId || log.user_id;
            const actor = users.find((u: any) => String(u.id) === String(actorId));
            const logDate = new Date(log.createdAt || log.created_at || Date.now());
            
            const rawTable = log.tableName || log.table_name || "";
            const entityLabel = rawTable === 'agendas' ? 'agenda' : 
                               rawTable === 'profiles' ? 'profil' : 
                               (rawTable ? rawTable.toLowerCase().replace(/s$/, '') : 'agenda');

            return (
              <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-muted/10 transition-colors">
                <td className="p-5 text-center">
                  <div className={cn("inline-flex p-2 rounded-xl", config.color)}>
                    <config.icon className="w-4 h-4" />
                  </div>
                </td>
                <td className="p-5">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 border">
                      <AvatarImage src={actor?.photoUrl || actor?.avatar_url} />
                      <AvatarFallback className="text-[10px]">{actor?.fullName?.charAt(0) || 'S'}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">
                        {actor?.id === currentUser?.id ? 'Anda' : actor?.fullName || actor?.full_name || 'Sistem'}
                      </span>
                      <span className="text-[9px] uppercase font-black text-primary/60">{actor?.role || 'User'}</span>
                    </div>
                  </div>
                </td>
                <td className="p-5">
                   <p className="text-sm font-medium text-foreground/80">
                     {isSoftDelete ? 'Menghapus' : config.label} {entityLabel}
                   </p>
                </td>
                <td className="p-5 text-right">
                  <div className="text-xs font-bold">
                    {isValid(logDate) ? format(logDate, 'dd MMM yyyy') : '-'}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-medium">
                    {isValid(logDate) ? `pukul ${format(logDate, 'HH:mm')}` : ''}
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};