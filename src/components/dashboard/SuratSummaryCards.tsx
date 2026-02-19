import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/lib/supabase";
import { CheckCircle2, FileText, Clock, XCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export const SuratSummaryCards = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['surat-stats-dashboard'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const { data, error } = await supabase
        .from('surat_registrasi')
        .select('status')
        .eq('created_by', session.user.id);

      if (error) throw error;

      return {
        total: data.length,
        completed: data.filter(s => s.status === 'SELESAI').length,
        processing: data.filter(s => s.status === 'PROSES').length,
        rejected: data.filter(s => s.status === 'REJECTED').length,
      };
    },
    refetchInterval: 30000, // Sync tiap 30 detik
  });

  if (isLoading) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 bg-muted rounded-xl" />
      ))}
    </div>
  );

  if (!stats) return null;

  const cardItems = [
    { label: 'Total Pengajuan', value: stats.total, icon: FileText, color: 'text-muted-foreground', total: null },
    { label: 'Selesai', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-600', total: stats.total, isProgress: true },
    { label: 'Proses', value: stats.processing, icon: Clock, color: 'text-amber-600', total: null },
    { label: 'Ditolak', value: stats.rejected, icon: XCircle, color: 'text-red-600', total: null },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cardItems.map((item, i) => (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          key={item.label} 
          className="bg-card border border-border p-5 rounded-2xl relative overflow-hidden shadow-sm group hover:border-primary/30 transition-all"
        >
          <div className={`flex items-center gap-2 ${item.color} mb-2`}>
            <item.icon size={14} />
            <span className="text-[10px] font-black uppercase tracking-wider leading-none">{item.label}</span>
          </div>
          
          <div className="flex items-baseline gap-2">
            <p className={`text-3xl font-black tracking-tighter ${item.color === 'text-muted-foreground' ? 'text-foreground' : item.color}`}>
              {item.value}
            </p>
            {item.isProgress && (
              <span className="text-[11px] font-bold text-muted-foreground/50">
                / {item.total} <span className="text-[9px] ml-0.5">ITEMS</span>
              </span>
            )}
          </div>

          {item.isProgress && item.total! > 0 && (
            <div className="absolute bottom-0 left-0 w-full h-1 bg-muted">
              <div 
                className="h-full bg-emerald-500 transition-all duration-1000" 
                style={{ width: `${(item.value / item.total!) * 100}%` }} 
              />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
};