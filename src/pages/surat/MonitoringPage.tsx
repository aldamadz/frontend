import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/lib/supabase";
import { 
  Search, Loader2, MessageSquare, Info, Eye,
  Clock, AlertCircle, CheckCircle2, User, ArrowUpRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Import Komponen Lokal
import { SuratSummaryCards } from '@/components/dashboard/SuratSummaryCards';
import { PreviewModal } from "@/components/surat/PreviewModal";

const MonitoringPage = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // State untuk Feedback & Detail Modal
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedSurat, setSelectedSurat] = useState<any>(null);
  const [readFeedbacks, setReadFeedbacks] = useState<string[]>([]);

  // 1. FETCH DATA
  const { data: allData = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['surat-monitoring-list'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");
      
      const { data, error } = await supabase
        .from('surat_registrasi')
        .select(`
          *, 
          surat_signatures (
            id, step_order, is_signed, status, role_name, signed_at,
            profiles:user_id ( full_name )
          )
        `)
        .eq('created_by', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 10000, 
  });

  // 2. LOAD READ STATUS (LOCAL STORAGE)
  useEffect(() => {
    const saved = localStorage.getItem('read_pic_feedbacks');
    if (saved) setReadFeedbacks(JSON.parse(saved));
  }, []);

  const markAsRead = (suratId: string) => {
    if (!readFeedbacks.includes(suratId)) {
      const updated = [...readFeedbacks, suratId];
      setReadFeedbacks(updated);
      localStorage.setItem('read_pic_feedbacks', JSON.stringify(updated));
    }
  };

  // 3. PREVIEW LOGIC
  const handleOpenPreview = (url: string) => {
    if (!url) return;
    const cleanUrl = url.split('?')[0]; 
    const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(cleanUrl)}&wdPrint=0&wdEmbedCode=0&cb=${Date.now()}`;
    setPreviewUrl(viewerUrl);
  };

  // 4. FILTERING
  const filtered = allData.filter(s => {
    const matchSearch = (s.judul_surat?.toLowerCase() || "").includes(search.toLowerCase()) ||
                        (s.no_surat?.toLowerCase() || "").includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (queryError) return (
    <div className="h-screen flex items-center justify-center p-10 text-center">
      <div className="space-y-4">
        <AlertCircle className="mx-auto text-destructive" size={40} />
        <p className="text-sm font-bold uppercase tracking-widest">Connection Error</p>
        <p className="text-xs text-muted-foreground">{(queryError as any).message}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 space-y-8 animate-in fade-in duration-700">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
            <h1 className="text-3xl font-black text-foreground tracking-tighter uppercase">
              Status <span className="text-primary/50 font-light tracking-widest">Pengajuan</span>
            </h1>
          </div>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.4em] ml-5">
            Lacak pergerakan dokumen anda secara real-time
          </p>
        </div>
      </div>

      <SuratSummaryCards />

      {/* FILTER AREA */}
      <div className="space-y-6 bg-card/30 p-4 rounded-2xl border border-border/50 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" size={16} />
            <Input 
              placeholder="CARI JUDUL ATAU NOMOR SURAT..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 bg-background border-border rounded-xl uppercase text-[10px] font-bold tracking-widest"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {['all', 'PROSES', 'SELESAI', 'REJECTED'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-4 py-2 rounded-lg text-[9px] font-black tracking-widest border transition-all uppercase",
                  statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"
                )}
              >
                {s === 'all' ? 'Semua Status' : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* DATA GRID */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="animate-spin text-primary" size={32} />
          <span className="text-muted-foreground font-bold text-[9px] tracking-[0.3em] uppercase">Mensinkronkan Dokumen...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
          {filtered.map((surat) => {
            const sigs = [...(surat.surat_signatures || [])].sort((a,b) => a.step_order - b.step_order);
            const finishedCount = sigs.filter(s => s.is_signed).length;
            const progress = sigs.length > 0 ? (finishedCount / sigs.length) * 100 : 0;
            const currentSigner = sigs.find(s => s.step_order === surat.current_step);
            const hasNewFeedback = surat.pic_feedback && !readFeedbacks.includes(surat.id);

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
                  <div className="flex items-center gap-2">
                     {hasNewFeedback && (
                        <div className="relative">
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-ping" />
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                            <MessageSquare size={14} className="text-primary" />
                        </div>
                     )}
                     <span className="text-[10px] font-bold text-muted-foreground tracking-tighter uppercase">
                        {new Date(surat.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                     </span>
                  </div>
                </div>

                <div className="flex-1 space-y-6">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-foreground leading-tight line-clamp-2 uppercase group-hover:text-primary transition-colors">
                      {surat.judul_surat}
                    </h3>
                    <p className="text-[10px] font-mono text-muted-foreground tracking-tighter bg-muted w-fit px-2 py-0.5 rounded uppercase">
                      {surat.no_surat || 'NO-REF-PENDING'}
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Pipeline Progress</span>
                      <span className="text-xs font-black tabular-nums text-primary">{Math.round(progress)}%</span>
                    </div>
                    <div className="flex gap-1.5 h-1.5 w-full">
                      {sigs.map((s, i) => {
                        const isCurrentWaiting = !s.is_signed && s.step_order === surat.current_step && surat.status === 'PROSES';
                        return (
                          <div 
                            key={i}
                            className={cn(
                              "flex-1 rounded-full transition-all duration-500",
                              s.status === 'REJECTED' ? "bg-red-500" :
                              s.is_signed ? "bg-emerald-500" : 
                              isCurrentWaiting ? "bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "bg-muted"
                            )}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-border/40 space-y-3">
                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <Info size={12} className="text-muted-foreground shrink-0" />
                    <span className="text-[9px] font-black uppercase text-foreground/70 tracking-tight truncate">
                      {surat.status === 'PROSES' ? `Posisi: ${currentSigner?.role_name || 'Menunggu'}` : 'Status Final'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => {
                        setSelectedSurat(surat);
                        setIsChatOpen(true);
                        markAsRead(surat.id);
                      }}
                      className="h-10 flex items-center justify-center gap-2 rounded-xl bg-muted text-foreground hover:bg-muted/80 transition-all border border-border"
                    >
                      <MessageSquare size={14} />
                      <span className="text-[9px] font-black uppercase tracking-widest">Detail</span>
                    </button>
                    <button 
                      onClick={() => handleOpenPreview(surat.file_path)}
                      className="h-10 flex items-center justify-center gap-2 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all shadow-sm group/btn"
                    >
                      <Eye size={14} className="group-hover/btn:scale-110 transition-transform" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Preview</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL & FEEDBACK MODAL */}
      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-card border-border rounded-3xl shadow-2xl">
          <DialogHeader className="p-6 border-b border-border bg-muted/20">
             <div className="flex items-center gap-4">
                <div className="bg-primary/10 p-2 rounded-lg"><Info className="text-primary" size={20} /></div>
                <div>
                  <DialogTitle className="text-sm font-black uppercase tracking-tight">Informasi Progress Dokumen</DialogTitle>
                  <DialogDescription className="text-[10px] font-medium uppercase text-muted-foreground">
                    Riwayat persetujuan & Feedback PIC
                  </DialogDescription>
                </div>
              </div>
          </DialogHeader>

          <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
            
            {/* PIC FEEDBACK SECTION (IF ANY) */}
            {selectedSurat?.pic_feedback && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center gap-2 text-primary">
                        <MessageSquare size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Feedback dari Admin (PIC)</span>
                    </div>
                    <div className="bg-primary/5 p-4 rounded-2xl border-2 border-dashed border-primary/20">
                        <p className="text-xs font-bold text-foreground leading-relaxed italic">
                            "{selectedSurat.pic_feedback}"
                        </p>
                        {selectedSurat?.pic_attachment && (
                            <a 
                                href={selectedSurat.pic_attachment} 
                                target="_blank" 
                                className="mt-3 inline-flex items-center gap-2 text-[9px] font-black text-primary bg-white px-3 py-1.5 rounded-lg border border-primary/20 hover:bg-primary hover:text-white transition-all uppercase"
                            >
                                <ArrowUpRight size={12} /> Lihat Lampiran PIC
                            </a>
                        )}
                    </div>
                </div>
            )}

            {/* SIGNATURE TIMELINE */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Timeline Persetujuan</span>
                </div>
                <div className="space-y-3 relative">
                    <div className="absolute left-[13px] top-2 bottom-2 w-0.5 bg-border" />
                    {[...(selectedSurat?.surat_signatures || [])].sort((a,b) => a.step_order - b.step_order).map((sig) => (
                        <div key={sig.id} className="relative pl-9">
                            <div className={cn(
                                "absolute left-0 w-7 h-7 rounded-full flex items-center justify-center z-10 border-4 border-background",
                                sig.is_signed ? "bg-emerald-500 text-white" : 
                                sig.status === 'REJECTED' ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"
                            )}>
                                {sig.is_signed ? <CheckCircle2 size={12} /> : <span className="text-[10px] font-bold">{sig.step_order}</span>}
                            </div>
                            <div className="flex flex-col p-3 rounded-xl border border-border bg-muted/5">
                                <span className="text-[10px] font-black uppercase text-foreground">{sig.role_name}</span>
                                <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-medium uppercase">
                                    <User size={10} /> {(sig.profiles as any)?.full_name || 'Menunggu Antrian...'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ADVICE FOOTER */}
            <div className="pt-4 border-t border-border">
                <div className="flex gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-amber-700">
                    <Info size={16} className="shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-tight">Instruksi Revisi</p>
                        <p className="text-[10px] font-bold leading-normal opacity-90">
                            Jika terdapat catatan penolakan atau feedback perbaikan, silakan perbaiki file anda dan lakukan <span className="underline">Registrasi Ulang</span> untuk mendapatkan nomor surat baru atau mengikuti alur kembali.
                        </p>
                    </div>
                </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PreviewModal 
        isOpen={!!previewUrl} 
        fileUrl={previewUrl || ""} 
        onClose={() => setPreviewUrl(null)} 
      />
    </div>
  );
};

export default MonitoringPage;