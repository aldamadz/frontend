import { motion } from 'framer-motion';
import { format, isValid } from 'date-fns';
import { Search, FileEdit, Plus, CheckCircle, Trash2, LogIn } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ActivityLog, User, Agenda } from '@/types/agenda';
import { cn } from '@/lib/utils';

interface ActivityLogsViewProps {
  logs: ActivityLog[];
  users: User[];
  agendas: Agenda[];
  currentUser: User | null;
}

const getActionConfig = (action: string, newData?: any) => {
  const normalizedAction = action?.toUpperCase();
  if (normalizedAction === 'UPDATE' && newData?.status === 'Completed') {
    return { icon: CheckCircle, color: 'bg-emerald-500/10 text-emerald-600' };
  }
  const configs: Record<string, { icon: any; color: string }> = {
    CREATE: { icon: Plus, color: 'bg-emerald-500/10 text-emerald-600' },
    UPDATE: { icon: FileEdit, color: 'bg-blue-500/10 text-blue-600' },
    DELETE: { icon: Trash2, color: 'bg-rose-500/10 text-rose-600' },
    LOGIN: { icon: LogIn, color: 'bg-indigo-500/10 text-indigo-600' },
  };
  return configs[normalizedAction] || { icon: FileEdit, color: 'bg-muted text-muted-foreground' };
};

export const ActivityLogsView = ({ logs, users, agendas, currentUser }: ActivityLogsViewProps) => {
  
  const getLogDescription = (log: ActivityLog) => {
    const action = log.action?.toUpperCase();
    const title = log.newValues?.title || log.oldValues?.title || "Agenda";
    switch (action) {
      case 'CREATE': return `Menyusun rencana baru: "${title}"`;
      case 'DELETE': return `Menghapus "${title}"`;
      case 'UPDATE': return log.newValues?.status === 'Completed' ? `Menyelesaikan tugas: "${title}"` : `Memperbarui "${title}"`;
      default: return `Aktivitas sistem pada "${title}"`;
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse table-fixed">
        <thead className="bg-muted/40 border-b border-border/50">
          <tr>
            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-24 text-center">Tipe</th>
            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-64">Pelaku</th>
            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Keterangan Aktivitas</th>
            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-48 text-right">Waktu</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {logs.length > 0 ? (
            logs.map((log, idx) => {
              const actor = users.find(u => String(u.id) === String(log.userId || log.user_id));
              const actorName = log.profiles?.fullName || actor?.fullName || 'System';
              const { icon: Icon, color: colorClass } = getActionConfig(log.action, log.newValues);
              const logDate = new Date(log.createdAt || Date.now());

              return (
                <motion.tr 
                  key={`${log.id}-${idx}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-primary/[0.01] transition-colors group"
                >
                  <td className="px-8 py-5 text-center">
                    <div className={cn("inline-flex p-2.5 rounded-2xl transition-transform group-hover:scale-110 shadow-sm", colorClass)}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                        <AvatarImage src={log.profiles?.avatarUrl || actor?.photoUrl} />
                        <AvatarFallback className="text-[10px] font-bold bg-primary/5">
                          {actorName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col truncate">
                        <span className="font-bold text-sm truncate leading-tight mb-1">
                          {String(log.userId) === String(currentUser?.id) ? 'Anda' : actorName}
                        </span>
                        <span className="text-[9px] uppercase font-black text-primary/70 italic">
                          {actor?.role || 'Access Log'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-medium text-foreground/90 leading-relaxed">
                      {getLogDescription(log)}
                    </p>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="text-xs font-black text-foreground/80">{isValid(logDate) ? format(logDate, 'dd MMM yyyy') : '-'}</div>
                    <div className="text-[10px] text-muted-foreground font-bold italic">
                      pukul {isValid(logDate) ? format(logDate, 'HH:mm') : '-'}
                    </div>
                  </td>
                </motion.tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={4} className="py-32 text-center">
                 <div className="flex flex-col items-center opacity-20 italic">
                    <Search className="h-12 w-12 mb-2" />
                    <p className="text-lg font-black uppercase tracking-widest">Tidak ada data</p>
                 </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};