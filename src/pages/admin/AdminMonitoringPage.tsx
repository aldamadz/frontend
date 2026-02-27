import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/lib/supabase";
import { 
  Search, AlertCircle, Loader2, 
  Eye, ChevronLeft, ChevronRight, 
  CheckCircle2, Clock, X, Calendar 
} from 'lucide-react';
import { 
  isWithinInterval, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth 
} from 'date-fns';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Import Komponen Lokal
import { SuratSummaryCards } from '@/components/dashboard/SuratSummaryCards';
import { PreviewModal } from "@/components/surat/PreviewModal";

const AdminMonitoringPage = () => {
  // --- STATE ---
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSurat, setSelectedSurat] = useState<any | null>(null);
  const itemsPerPage = 6;

  // --- 1. FETCH DATA ---
  const { data: allData = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['admin-surat-monitoring-view'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('view_monitoring_signatures')
        .select('*')
        .order('no_surat', { ascending: false });

      if (error) throw error;

      const map = new Map();
      data.forEach((curr: any) => {
        if (!map.has(curr.surat_id)) {
          map.set(curr.surat_id, {
            id: curr.surat_id,
            no_surat: curr.no_surat,
            judul_surat: curr.judul_surat,
            current_step: curr.surat_current_step,
            tanggal_input: curr.tanggal_input || curr.signed_at || new Date().toISOString(),
            status: 'PROSES',
            signatures: []
          });
        }
        const surat = map.get(curr.surat_id);
        if (!surat.signatures.find((s: any) => s.id === curr.signature_id)) {
          surat.signatures.push({
            id: curr.signature_id,
            role_name: curr.role_name,
            nama_pejabat: curr.nama_pejabat,
            step_order: curr.step_order,
            is_signed: curr.is_signed,
            signed_at: curr.signed_at,
            status: curr.signature_status
          });
        }
        if (curr.signature_status === 'REJECTED') surat.status = 'REJECTED';
      });

      return Array.from(map.values()).map(s => {
        const totalStep = s.signatures.length;
        const signedCount = s.signatures.filter((sig: any) => sig.is_signed).length;
        if (s.status !== 'REJECTED' && signedCount === totalStep && totalStep > 0) {
          s.status = 'SELESAI';
        }
        s.signatures.sort((a: any, b: any) => a.step_order - b.step_order);
        return s;
      });
    },
    refetchInterval: 30000,
  });

  // --- 2. FILTERING LOGIC ---
  const filtered = useMemo(() => {
    return allData.filter(s => {
      const matchSearch = (s.judul_surat?.toLowerCase() || "").includes(search.toLowerCase()) ||
                          (s.no_surat?.toLowerCase() || "").includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      
      let matchDate = true;
      if (dateFilter !== 'all' && s.tanggal_input) {
        const docDate = new Date(s.tanggal_input);
        const now = new Date();
        if (dateFilter === 'today') matchDate = isWithinInterval(docDate, { start: startOfDay(now), end: endOfDay(now) });
        else if (dateFilter === 'week') matchDate = isWithinInterval(docDate, { start: startOfWeek(now), end: endOfWeek(now) });
        else if (dateFilter === 'month') matchDate = isWithinInterval(docDate, { start: startOfMonth(now), end: endOfMonth(now) });
        else if (dateFilter === 'custom' && dateRange.start && dateRange.end) {
          matchDate = isWithinInterval(docDate, { 
            start: startOfDay(new Date(dateRange.start)), 
            end: endOfDay(new Date(dateRange.end)) 
          });
        }
      }
      return matchSearch && matchStatus && matchDate;
    });
  }, [allData, search, statusFilter, dateFilter, dateRange]);

  // --- 3. PAGINATION ---
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  if (queryError) return (
    <div className="h-64 flex flex-col items-center justify-center text-center">
       <AlertCircle className="text-destructive mb-2" />
       <p className="text-xs font-bold uppercase tracking-widest">Error Loading View</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b pb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-primary rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
            <h1 className="text-3xl font-black tracking-tighter uppercase">
              Admin <span className="text-primary/50 font-light">Monitoring</span>
            </h1>
          </div>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.4em] ml-5">Live Signature Tracking System</p>
        </div>
      </div>

      <SuratSummaryCards />

      {/* SEARCH & FILTERS CONTAINER */}
      <div className="space-y-4 bg-card/50 p-6 rounded-2xl border shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <Input 
              placeholder="CARI JUDUL / NO SURAT..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="pl-10 h-10 bg-background text-[10px] font-bold tracking-widest uppercase border-muted-foreground/20"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0">
            {['all', 'PROSES', 'SELESAI', 'REJECTED'].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
                className={cn(
                  "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all shrink-0",
                  statusFilter === s ? "bg-primary text-white border-primary" : "bg-background text-muted-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

{/* Date Filter Row - REVISI DATEPICKER */}
<div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-4 border-t border-dashed">
  <div className="flex flex-wrap items-center gap-3">
    <div className="flex items-center gap-2 text-[9px] font-black text-muted-foreground uppercase tracking-wider mr-1">
      <Calendar size={12} className="text-primary" /> Filter Waktu:
    </div>
    <div className="flex gap-1.5 flex-wrap">
      {['all', 'today', 'week', 'month', 'custom'].map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => { setDateFilter(id); setCurrentPage(1); }}
          className={cn(
            "px-3 py-1.5 rounded-md text-[8px] font-bold uppercase tracking-wider border transition-all",
            dateFilter === id 
              ? "bg-secondary text-secondary-foreground border-secondary shadow-sm" 
              : "bg-transparent text-muted-foreground hover:bg-muted"
          )}
        >
          {id === 'all' ? 'Semua Data' : id === 'today' ? 'Hari Ini' : id === 'week' ? 'Minggu Ini' : id === 'month' ? 'Bulan Ini' : 'Custom Range'}
        </button>
      ))}
    </div>
  </div>

  {/* Input Tanggal - Dioptimalkan untuk memicu DatePicker Browser */}
  {dateFilter === 'custom' && (
    <div className="flex items-center gap-2 p-1.5 bg-muted/50 rounded-lg animate-in fade-in slide-in-from-left-2 duration-300">
      <div className="group relative">
        <Input 
          type="date" 
          className="h-8 text-[10px] w-[140px] bg-background font-bold border-muted-foreground/20 
                     cursor-pointer block focus:ring-1 appearance-none" 
          value={dateRange.start}
          // Trik CSS: Memastikan seluruh area input bisa diklik untuk memicu picker
          style={{ colorScheme: 'light' }} 
          onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
        />
      </div>
      
      <span className="text-muted-foreground text-[9px] font-black uppercase">s/d</span>
      
      <div className="group relative">
        <Input 
          type="date" 
          className="h-8 text-[10px] w-[140px] bg-background font-bold border-muted-foreground/20 
                     cursor-pointer block focus:ring-1 appearance-none" 
          value={dateRange.end}
          style={{ colorScheme: 'light' }}
          onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
        />
      </div>

      <Button 
        variant="ghost" 
        size="icon" 
        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
        onClick={() => {
          setDateRange({ start: '', end: '' });
          setDateFilter('all');
        }}
      >
        <X size={14} />
      </Button>
    </div>
  )}
</div>
      </div>

      {/* GRID CARDS */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="animate-spin text-primary" size={32} />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">Syncing Data...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedData.map((surat) => {
            const finished = surat.signatures.filter((sig: any) => sig.is_signed).length;
            const progress = (finished / (surat.signatures.length || 1)) * 100;
            const currentSigner = surat.signatures.find((s: any) => s.step_order === surat.current_step);

            return (
              <div key={surat.id} className="group p-6 bg-card border rounded-2xl hover:border-primary/50 transition-all shadow-sm relative overflow-hidden flex flex-col">
                <div className={cn(
                  "absolute top-0 left-0 right-0 h-1",
                  surat.status === 'SELESAI' ? 'bg-emerald-500' : surat.status === 'REJECTED' ? 'bg-red-500' : 'bg-amber-500'
                )} />
                <div className="flex justify-between items-start mb-6">
                  <Badge className={cn(
                    "text-[9px] font-black uppercase tracking-widest",
                    surat.status === 'SELESAI' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 
                    surat.status === 'REJECTED' ? 'bg-red-500/10 text-red-600 border-red-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                  )} variant="outline">
                    {surat.status}
                  </Badge>
                  <span className="text-[9px] font-mono text-muted-foreground">{surat.no_surat || 'N/A'}</span>
                </div>
                <div className="flex-1 space-y-5">
                  <h3 className="font-bold text-sm uppercase leading-snug line-clamp-2 min-h-[2.5rem]">{surat.judul_surat}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                      <span>Progress</span>
                      <span className="text-primary">{Math.round(progress)}%</span>
                    </div>
                    <div className="flex gap-1 h-1.5">
                      {surat.signatures.map((sig: any) => (
                        <div key={sig.id} className={cn("flex-1 rounded-full transition-all", sig.is_signed ? "bg-emerald-500" : sig.status === 'REJECTED' ? "bg-red-500" : sig.step_order === surat.current_step ? "bg-amber-400 animate-pulse" : "bg-muted")} />
                      ))}
                    </div>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-xl flex items-center gap-3 border">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      {surat.status === 'SELESAI' ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[8px] font-black uppercase text-muted-foreground">Current Step</span>
                      <span className="text-[10px] font-bold truncate">{currentSigner?.nama_pejabat || 'Queueing'}</span>
                    </div>
                  </div>
                </div>
                <Button className="mt-6 w-full rounded-xl text-[10px] font-black uppercase tracking-widest" onClick={() => setSelectedSurat(surat)}>
                  <Eye size={14} className="mr-2" /> View Tracking
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 pt-4 pb-20">
          <Button disabled={currentPage === 1} variant="ghost" onClick={() => setCurrentPage(p => p - 1)}>
            <ChevronLeft size={20} />
          </Button>
          <div className="flex gap-1">
            {[...Array(totalPages)].map((_, i) => (
              <button key={i} onClick={() => setCurrentPage(i + 1)} className={cn("w-8 h-8 rounded-lg text-[10px] font-black border", currentPage === i + 1 ? "bg-primary text-white" : "bg-card")}>
                {i + 1}
              </button>
            ))}
          </div>
          <Button disabled={currentPage === totalPages} variant="ghost" onClick={() => setCurrentPage(p => p + 1)}>
            <ChevronRight size={20} />
          </Button>
        </div>
      )}

      {/* MODAL DETAIL TRACKING */}
      {selectedSurat && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b flex justify-between items-center bg-muted/30">
              <div>
                <h2 className="text-sm font-black uppercase tracking-tighter">Tracking Detail</h2>
                <p className="text-[10px] text-muted-foreground font-mono">{selectedSurat.no_surat}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedSurat(null)} className="rounded-full">
                <X size={18} />
              </Button>
            </div>
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {selectedSurat.signatures.map((sig: any, idx: number) => (
                <div key={sig.id} className="flex gap-4 relative">
                  {idx !== selectedSurat.signatures.length - 1 && <div className="absolute left-[15px] top-8 bottom-[-20px] w-[2px] bg-border" />}
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 shadow-sm", sig.is_signed ? "bg-emerald-500 text-white" : sig.status === 'REJECTED' ? "bg-red-500 text-white" : "bg-muted text-muted-foreground")}>
                    {sig.is_signed ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                  </div>
                  <div className="flex-1 pb-4 border-b border-dashed">
                    <p className="text-[10px] font-black uppercase text-primary">{sig.role_name}</p>
                    <p className="text-xs font-bold">{sig.nama_pejabat}</p>
                    {sig.is_signed && sig.signed_at && (
                      <span className="text-[8px] font-bold text-muted-foreground">{new Date(sig.signed_at).toLocaleString('id-ID')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-muted/20 border-t">
              <Button className="w-full rounded-xl uppercase text-[10px] font-black h-11" variant="outline" onClick={() => setSelectedSurat(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      <PreviewModal isOpen={!!previewUrl} fileUrl={previewUrl || ""} onClose={() => setPreviewUrl(null)} />
    </div>
  );
};

export default AdminMonitoringPage;