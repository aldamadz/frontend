// src/components/calendar/CalendarAgendaItem.tsx
import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Agenda, AgendaStatus } from '@/types/agenda';
import { cn } from '@/lib/utils';

interface CalendarAgendaItemProps {
  agenda: Agenda;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

const statusStyles: Record<AgendaStatus, string> = {
  Scheduled: 'bg-blue-500/10 border-l-blue-500 text-blue-700 dark:text-blue-400',
  Ongoing: 'bg-amber-500/10 border-l-amber-500 text-amber-700 dark:text-amber-400',
  Completed: 'bg-emerald-500/10 border-l-emerald-500 text-emerald-700 dark:text-emerald-500/60 opacity-60 shadow-none',
  Overdue: 'bg-rose-500/10 border-l-rose-500 text-rose-700 dark:text-rose-400',
  Deleted: 'bg-gray-500/10 border-l-gray-500 text-gray-700 opacity-50',
};

// Gunakan forwardRef agar Framer Motion bisa mengakses elemen DOM
export const CalendarAgendaItem = forwardRef<HTMLDivElement, CalendarAgendaItemProps>(
  ({ agenda, onClick, onDragStart, onDragEnd, isDragging }, ref) => {
    return (
      <motion.div
        ref={ref} // Pasang ref di sini
        draggable
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onDragStart={(e) => {
          e.stopPropagation();
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        className={cn(
          "text-xs leading-snug px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing border-l-[3px] font-bold mb-1 select-none shadow-sm transition-all",
          "line-clamp-1 break-all decoration-none", 
          statusStyles[agenda.status] || statusStyles.Scheduled,
          isDragging && "opacity-50 ring-2 ring-primary"
        )}
        layout
        whileHover={{ x: 3, backgroundColor: "rgba(0,0,0,0.08)" }}
      >
        {agenda.status === 'Completed' && <span className="mr-1 italic">✓</span>}
        {agenda.title}
      </motion.div>
    );
  }
);

// Penting untuk debugging di React DevTools
CalendarAgendaItem.displayName = "CalendarAgendaItem";