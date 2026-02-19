import { Search, Filter, X, Calendar as CalendarIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MonitoringFilterProps {
  search: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusChange: (val: string) => void;
  dateFilter: string; // 'all' | 'today' | 'week' | 'month'
  onDateChange: (val: string) => void;
}

export const MonitoringFilter = ({
  search, onSearchChange,
  statusFilter, onStatusChange,
  dateFilter, onDateChange
}: MonitoringFilterProps) => {

  const statuses = [
    { label: 'SEMUA', value: 'all' },
    { label: 'PROSES', value: 'PROSES' },
    { label: 'SELESAI', value: 'SELESAI' },
    { label: 'REJECTED', value: 'REJECTED' },
  ];

  const dateRanges = [
    { label: 'SEMUA WAKTU', value: 'all' },
    { label: 'HARI INI', value: 'today' },
    { label: 'MINGGU INI', value: 'week' },
    { label: 'BULAN INI', value: 'month' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        
        {/* Search Bar */}
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} />
          <Input 
            placeholder="CARI NOMOR ATAU JUDUL SURAT..." 
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-11 bg-card border-border shadow-sm rounded-xl focus-visible:ring-primary/20 uppercase text-[11px] font-bold tracking-widest transition-all"
          />
          {search && (
            <button 
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Date Filter Chips */}
        <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-xl border border-border">
          {dateRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => onDateChange(range.value)}
              className={cn(
                "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                dateFilter === range.value 
                  ? "bg-background text-primary shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status Filter Chips */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-2 mr-2">
          <Filter size={12} className="text-muted-foreground" />
          <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">Filter Status:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <Badge
              key={s.value}
              onClick={() => onStatusChange(s.value)}
              className={cn(
                "cursor-pointer px-3 py-1 rounded-full text-[9px] font-black tracking-widest border transition-all shadow-none",
                statusFilter === s.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
              )}
            >
              {s.label}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
};