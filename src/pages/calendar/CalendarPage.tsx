import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileDown, FileSpreadsheet, FileText, Calendar as CalendarIcon, Plus } from 'lucide-react';

import { CalendarView } from '@/components/calendar/CalendarView';
import { AgendaModal } from '@/components/agenda/AgendaModal';
import { getAgendas, saveAgenda } from '@/services/agenda.service';
import { exportCalendarData } from '@/services/export.service';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Agenda } from '@/types/agenda';
import { supabase } from '@/lib/supabase';

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAgenda, setSelectedAgenda] = useState<Agenda | null>(null);
  const [prefilledDate, setPrefilledDate] = useState<Date | null>(null);

  const { data: agendas = [], isLoading } = useQuery({
    queryKey: ['agendas'],
    queryFn: getAgendas
  });

  useEffect(() => {
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendas' }, () => {
        queryClient.invalidateQueries({ queryKey: ['agendas'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAgenda(null);
    setPrefilledDate(null);
  };

  const userName = useMemo(() => {
    // @ts-ignore
    return agendas[0]?.profiles?.fullName || "User";
  }, [agendas]);

  if (isLoading) return <div className="p-8"><Skeleton className="w-full h-[500px] rounded-xl opacity-20" /></div>;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
            <CalendarIcon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Agenda Kerja</h1>
            <p className="text-sm text-muted-foreground">{userName} — {agendas.length} Entri</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-lg border-border font-medium">
                <FileDown className="w-4 h-4 mr-2" /> Ekspor
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-1">
              <DropdownMenuItem onClick={() => exportCalendarData(agendas, 'excel', userName)} className="cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-500" /> Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportCalendarData(agendas, 'pdf', userName)} className="cursor-pointer">
                <FileText className="w-4 h-4 mr-2 text-red-500" /> PDF (.pdf)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={() => { setPrefilledDate(new Date()); setIsModalOpen(true); }} className="rounded-lg bg-primary font-semibold shadow-sm">
            <Plus className="w-4 h-4 mr-1" /> Agenda Baru
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <CalendarView
          agendas={agendas}
          onDateClick={(date) => {
            const now = new Date();
            date.setHours(now.getHours(), now.getMinutes());
            setPrefilledDate(date);
            setIsModalOpen(true);
          }}
          onAgendaClick={(a) => { setSelectedAgenda(a); setIsModalOpen(true); }}
          onAgendaDrop={(id, date) => {
            // Logika update posisi agenda (opsional)
          }}
        />
      </div>

      <AgendaModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        agenda={selectedAgenda}
        prefilledDate={prefilledDate}
        onSave={(data) => {
          // Logika mutation save (opsional)
        }}
      />
    </div>
  );
}