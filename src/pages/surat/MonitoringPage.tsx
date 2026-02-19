import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/lib/supabase";
import { 
  Search, AlertCircle, Loader2, 
  MessageSquare, Info, Filter, Eye 
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Import Komponen Lokal
import { SuratSummaryCards } from '@/components/dashboard/SuratSummaryCards';
import { PreviewModal } from "@/components/surat/PreviewModal";

const MonitoringPage = () => {
  // 1. STATES
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 2. FETCH DATA
  const { data: allData = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['surat-monitoring-list'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");
      const user = session.user;

      const { data, error } = await supabase
        .from('surat_registrasi')
        .select(`
          *,
          surat_signatures (
            id, step_order, is_signed, role_name, 
            status, catatan, signed_at, user_id
          )
        `)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 10000, 
  });

  // 3. LOGIKA PREVIEW (Membungkus URL dengan Office Viewer sebelum ke modal)
  const handleOpenPreview = (url: string) => {
    if (!url) return;
    const cleanUrl = url.split('?')[0]; 
    const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(cleanUrl)}&wdPrint=0&wdEmbedCode=0&cb=${Date.now()}`;
    setPreviewUrl(viewerUrl);
  };

  // 4. HELPER FORMAT TANGGAL
  const formatFullDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // 5. LOGIKA FILTERING
  const filtered = allData.filter(s => {
    const matchSearch = (s.judul_surat?.toLowerCase() || "").includes(search.toLowerCase()) ||
                        (s.no_surat?.toLowerCase() || "").includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;

    let matchDate = true;
    if (dateFilter !== 'all') {
      const createdDate = new Date(s.created_at);
      const now = new Date();
      if (dateFilter === 'today') {
        matchDate = createdDate.toDateString() === now.toDateString();
      } else if (dateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        matchDate = createdDate >= weekAgo;
      } else if (dateFilter === 'month') {
        matchDate = createdDate.getMonth() === now.getMonth() && 
                    createdDate.getFullYear() === now.getFullYear();
      }
    }
    return matchSearch && matchStatus && matchDate;
  });

  if (queryError) {
    return (
      <div className="h-screen flex items-center justify-center p-10">
        <div className="text-center space-y-4">
          <AlertCircle className="mx-auto text-destructive" size={40} />
          <p className="text-sm font-bold uppercase tracking-widest">Database Connection Error</p>
          <p className="text-xs text-muted-foreground">{(queryError as any).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 space-y-8 animate-in fade-in duration-700">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-primary rounded-full" />
            <h1 className="text-3xl font-black text-foreground tracking-tighter uppercase">
              Status <span className="text-primary/50 font-light tracking-widest">Pengajuan</span>
            </h1>
          </div>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.4em] ml-5">
            Monitor real-time progres dokumen anda
          </p>
        </div>
      </div>

      <SuratSummaryCards />

      {/* FILTER SECTION */}
      <div className="space-y-6 bg-card/30 p-4 rounded-2xl border border-border/50 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} />
            <Input 
              placeholder="CARI JUDUL ATAU NOMOR SURAT..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 bg-background border-border rounded-xl focus-visible:ring-primary/20 uppercase text-[10px] font-bold tracking-widest transition-all"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl border border-border/50">
            {['all', 'today', 'week', 'month'].map((range) => (
              <button
                key={range}
                onClick={() => setDateFilter(range)}
                className={cn(
                  "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                  dateFilter === range ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {range === 'all' ? 'Semua Waktu' : range === 'today' ? 'Hari Ini' : range === 'week' ? 'Minggu Ini' : 'Bulan Ini'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-4">
          <div className="flex items-center gap-2 mr-2">
            <Filter size={12} className="text-muted-foreground" />
            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">Filter Status:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {['all', 'PROSES', 'SELESAI', 'REJECTED'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1 rounded-full text-[9px] font-black tracking-widest border transition-all uppercase",
                  statusFilter === s ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/10" : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
                )}
              >
                {s === 'all' ? 'Semua' : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* LIST DATA */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="animate-spin text-primary" size={32} />
          <span className="text-muted-foreground font-bold text-[9px] tracking-[0.3em] uppercase italic">Memperbarui Data...</span>
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
          {filtered.map((surat) => {
            const sigs = [...(surat.surat_signatures || [])].sort((a,b) => a.step_order - b.step_order);
            const finished = sigs.filter(s => s.is_signed).length;
            const progress = sigs.length > 0 ? (finished / sigs.length) * 100 : 0;
            const currentSigner = sigs.find(s => s.step_order === surat.current_step);
            const lastNote = [...sigs].reverse().find(s => s.is_signed && s.catatan);

            return (
              <div key={surat.id} className="group flex flex-col p-6 bg-card border border-border rounded-2xl hover:border-primary/40 transition-all duration-300 shadow-sm relative overflow-hidden">
                
                <div className={cn(
                  "absolute top-0 left-0 w-1.5 h-full",
                  surat.status === 'SELESAI' ? "bg-emerald-500" : 
                  surat.status === 'REJECTED' ? "bg-red-500" : "bg-amber-500"
                )} />

                <div className="flex justify-between items-center mb-6">
                  <Badge variant="outline" className={cn(
                    "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border shadow-none",
                    surat.status === 'SELESAI' && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                    surat.status === 'REJECTED' && "bg-red-500/10 text-red-600 border-red-500/20",
                    surat.status === 'PROSES' && "bg-amber-500/10 text-amber-600 border-amber-500/20"
                  )}>
                    {surat.status}
                  </Badge>
                  <span className="text-[10px] font-bold text-muted-foreground tracking-tighter uppercase">
                    {formatFullDate(surat.created_at)}
                  </span>
                </div>

                <div className="flex-1 space-y-6">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-foreground leading-tight line-clamp-2 uppercase group-hover:text-primary transition-colors">
                      {surat.judul_surat}
                    </h3>
                    <p className="text-[10px] font-mono text-muted-foreground tracking-tighter bg-muted w-fit px-2 py-0.5 rounded">
                      {surat.no_surat || 'TANPA-NOMOR'}
                    </p>
                  </div>

                  {lastNote && (
                    <div className="bg-muted/50 rounded-xl p-3 space-y-2 border border-border/50">
                      <div className="flex items-center gap-2 text-primary">
                         <MessageSquare size={12} />
                         <span className="text-[9px] font-black uppercase tracking-widest">Catatan Terakhir</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground italic leading-relaxed font-medium">
                        "{lastNote.catatan}"
                      </p>
                    </div>
                  )}

                  {/* PROGRESS BAR - Bersih tanpa teks perhitungan */}
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Alur Persetujuan</span>
                      <span className="text-xs font-black tabular-nums text-primary">{Math.round(progress)}%</span>
                    </div>
                    <div className="flex gap-1.5 h-1.5 w-full">
                      {sigs.map((s, i) => (
                        <div 
                          key={i}
                          className={cn(
                            "flex-1 rounded-full transition-all duration-500",
                            s.status === 'REJECTED' ? "bg-red-500" :
                            s.is_signed ? "bg-emerald-500" : 
                            (s.step_order === surat.current_step && surat.status === 'PROSES' ? "bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.4)]" : "bg-muted")
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* FOOTER */}
                <div className="mt-8 pt-4 border-t border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Info size={12} className="text-muted-foreground shrink-0" />
                    <span className="text-[9px] font-black uppercase text-foreground/70 tracking-tight truncate">
                      {surat.status === 'SELESAI' ? 'Arsip Final' : 
                       surat.status === 'REJECTED' ? 'Dibatalkan' :
                       `Posisi: ${currentSigner?.role_name || 'Antrian'}`}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => handleOpenPreview(surat.file_path)}
                    className="h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white transition-all duration-300 flex items-center gap-2 group/btn shadow-sm"
                  >
                    <Eye size={14} className="transition-transform group-hover:scale-110" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Detail</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="h-[40vh] flex flex-col items-center justify-center border-2 border-dashed border-border rounded-3xl p-10 text-center space-y-3 bg-muted/10">
          <Search className="text-muted-foreground/30" size={40} />
          <h2 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.4em]">Data Tidak Ditemukan</h2>
        </div>
      )}

      {/* RENDER MODAL PREVIEW */}
      <PreviewModal 
        isOpen={!!previewUrl} 
        fileUrl={previewUrl || ""} 
        onClose={() => setPreviewUrl(null)} 
      />
    </div>
  );
};

export default MonitoringPage;