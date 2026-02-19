import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const RealtimeSync = () => {
  const queryClient = useQueryClient();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Fungsi sinkronisasi tanpa pengecekan sesi manual (mengurangi beban GoTrueClient)
    const handleSync = () => {
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(async () => {
        console.log('🔄 Realtime Sync: Refreshing active queries...');
        
        await queryClient.refetchQueries({
          predicate: (query) => 
            [
              'agendas', 'kpi', 'status-dist', 'dept-activity', 
              'recent-logs', 'surat-list', 'surat-inbox', 'surat-detail'
            ].includes(query.queryKey[0] as string),
          type: 'active'
        });
      }, 1000);
    };

    // Setup Listener
    const channel = supabase
      .channel('db-persuratan-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendas' }, () => handleSync())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'surat_registrasi' }, () => {
          console.log('📬 Change detected in surat_registrasi');
          handleSync();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'surat_signatures' }, () => {
          console.log('✍️ Change detected in surat_signatures');
          handleSync();
      })
      .subscribe();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ Tab Fokus: Sinkronisasi data...');
        handleSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
};