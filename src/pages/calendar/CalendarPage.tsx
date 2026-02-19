import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { CalendarView } from '@/components/calendar/CalendarView';
import { AgendaModal } from '@/components/agenda/AgendaModal';
import { getAgendas, saveAgenda } from '@/services/agenda.service';
import { Skeleton } from '@/components/ui/skeleton';
import { Agenda } from '@/types/agenda';
import { supabase } from '@/lib/supabase'; // Pastikan import supabase client Anda benar

export default function CalendarPage() {
  const queryClient = useQueryClient();
  
  // States untuk Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAgenda, setSelectedAgenda] = useState<Agenda | null>(null);
  const [prefilledDate, setPrefilledDate] = useState<Date | null>(null);

  // 1. Fetching Data Dasar
  const { data: agendas = [], isLoading } = useQuery({
    queryKey: ['agendas'],
    queryFn: getAgendas
  });

  // 2. REALTIME LISTENER
  // Mendengarkan perubahan di database (INSERT, UPDATE, DELETE)
  useEffect(() => {
    const channel = supabase
      .channel('calendar-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Mendengarkan semua perubahan
          schema: 'public',
          table: 'agendas',
        },
        (payload) => {
          console.log('Perubahan terdeteksi:', payload);
          // Invalidate cache agar TanStack Query mengambil data terbaru
          queryClient.invalidateQueries({ queryKey: ['agendas'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // 3. Mutation untuk Save (Create & Update)
  const upsertMutation = useMutation({
    mutationFn: async (formData: Partial<Agenda>) => {
      return saveAgenda(
        formData, 
        selectedAgenda?.id || undefined, 
        selectedAgenda || undefined
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendas'] });
      toast.success(selectedAgenda ? 'Agenda diperbarui' : 'Agenda baru disimpan');
      handleCloseModal();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Gagal menyimpan agenda');
    }
  });

  // 4. Mutation untuk Drag & Drop
  const dragMutation = useMutation({
    mutationFn: ({ id, date, agenda }: { id: string | number; date: Date; agenda: Agenda }) => {
      return saveAgenda({ ...agenda, startTime: date }, id, agenda);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendas'] });
      toast.success('Waktu agenda berhasil dipindahkan');
    }
  });

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAgenda(null);
    setPrefilledDate(null);
  };

  if (isLoading) return <div className="p-8"><Skeleton className="w-full h-[800px] rounded-2xl" /></div>;

  return (
    <div className="p-4 sm:p-8 max-w-[1600px] mx-auto">
      <CalendarView
        agendas={agendas}
        onDateClick={(date) => {
          setSelectedAgenda(null);
          
          const now = new Date();
          const dateWithCurrentTime = new Date(date);
          
          dateWithCurrentTime.setHours(now.getHours());
          dateWithCurrentTime.setMinutes(now.getMinutes());
          dateWithCurrentTime.setSeconds(0);
          dateWithCurrentTime.setMilliseconds(0);
          
          setPrefilledDate(dateWithCurrentTime);
          setIsModalOpen(true);
        }}
        onAgendaClick={(agenda) => {
          setSelectedAgenda(agenda);
          setPrefilledDate(null);
          setIsModalOpen(true);
        }}
        onAgendaDrop={(id, date) => {
          const target = agendas.find(a => String(a.id) === String(id));
          if (target) dragMutation.mutate({ id, date, agenda: target });
        }}
      />

      <AgendaModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        agenda={selectedAgenda}
        prefilledDate={prefilledDate}
        onSave={(data) => upsertMutation.mutate(data)}
        isLoading={upsertMutation.isPending}
      />
    </div>
  );
}