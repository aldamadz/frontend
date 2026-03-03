import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/lib/supabase";
import { 
  Search, AlertCircle, Loader2, 
  History, FileText, Clock,
  FileCheck, XCircle, CheckCircle2, MessageSquare, Send, Paperclip, X, Download, Info, User
} from 'lucide-react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Import Komponen Lokal
import { PreviewModal } from "@/components/surat/PreviewModal";

const MonitoringPICPage = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 1. STATES
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedSurat, setSelectedSurat] = useState<any | null>(null);
  
  // States untuk Feedback & Attachment
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<any | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 2. FETCH DATA
  const { data: allData = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['pic-monitoring-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surat_registrasi')
        .select(`
          *,
          surat_signatures (
            id, step_order, is_signed, role_name, 
            status, catatan, signed_at, file_path_snap,
            profiles:user_id ( full_name )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 15000, 
  });

  // 3. MUTATION: Update Feedback & Upload Attachment
  const updateFeedbackMutation = useMutation({
    mutationFn: async ({ id, feedback, file }: { id: string, feedback: string, file: File | null }) => {
      let attachmentUrl = feedbackTarget?.pic_attachment || null;

      if (file) {
        setIsUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `pic_${id}_${Date.now()}.${fileExt}`;
        const filePath = `pic-feedback/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('surat_attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('surat_attachments')
          .getPublicUrl(filePath);
        
        attachmentUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from('surat_registrasi')
        .update({ 
          pic_feedback: feedback,
          pic_attachment: attachmentUrl
        })
        .eq('id', id);

      if (error) throw error;
      return { feedback, attachmentUrl };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pic-monitoring-list'] });
      toast.success("Feedback & Lampiran berhasil disimpan");
      setIsFeedbackOpen(false);
      setFeedbackText('');
      setAttachmentFile(null);
      setIsUploading(false);
      if (selectedSurat?.id === feedbackTarget?.id) {
        setSelectedSurat({ ...selectedSurat, pic_feedback: data.feedback, pic_attachment: data.attachmentUrl });
      }
    },
    onError: (error: any) => {
      toast.error("Gagal memproses: " + error.message);
      setIsUploading(false);
    }
  });

  // 4. HELPERS
  const handleOpenPreview = (url: string) => {
    if (!url) return;
    const cleanUrl = url.split('?')[0]; 
    const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(cleanUrl)}&wdPrint=0&wdEmbedCode=0&cb=${Date.now()}`;
    setPreviewUrl(viewerUrl);
  };

  const formatFullDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const handleOpenFeedback = (surat: any) => {
    setFeedbackTarget(surat);
    setFeedbackText(surat.pic_feedback || '');
    setAttachmentFile(null);
    setIsFeedbackOpen(true);
  };

  // 5. FILTERING
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
              PIC <span className="text-primary/50 font-light tracking-widest">Monitoring</span>
            </h1>
          </div>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.4em] ml-5">
            Enterprise Document Control Center
          </p>
        </div>
      </div>

      {/* FILTER SECTION */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-card/30 p-4 rounded-2xl border border-border/50 shadow-sm">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" size={16} />
          <input 
            placeholder="CARI JUDUL ATAU NOMOR DOKUMEN..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 h-11 bg-background border border-border rounded-xl uppercase text-[10px] font-bold tracking-widest outline-none focus:ring-1 focus:ring-primary"
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
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* DATA GRID */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="animate-spin text-primary" size={32} />
          <span className="text-muted-foreground font-bold text-[9px] tracking-[0.3em] uppercase">Memuat Data PIC...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
          {filtered.map((surat) => {
            const sigs = [...(surat.surat_signatures || [])].sort((a,b) => a.step_order - b.step_order);
            const finishedCount = sigs.filter(s => s.is_signed).length;
            const progress = sigs.length > 0 ? (finishedCount / sigs.length) * 100 : 0;
            const currentSigner = sigs.find(s => s.step_order === surat.current_step);

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
                    <div className="flex items-center gap-2">
                        <p className="text-[10px] font-mono text-muted-foreground tracking-tighter bg-muted w-fit px-2 py-0.5 rounded uppercase">
                        {surat.no_surat || 'NO-REF-SYSTEM'}
                        </p>
                        {(surat.pic_feedback || surat.pic_attachment) && (
                            <span className="flex items-center gap-1 text-[8px] font-black text-primary animate-pulse bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">
                                <MessageSquare size={10} /> UPDATED
                            </span>
                        )}
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Progres Dokumen</span>
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
                              isCurrentWaiting ? "bg-amber-400 animate-pulse" : "bg-muted"
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
                      {surat.status === 'PROSES' ? `Posisi: ${currentSigner?.role_name || 'Antrian'}` : 'Status Final'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={() => setSelectedSurat(surat)}
                        className="h-10 flex items-center justify-center gap-2 rounded-xl bg-muted text-foreground hover:bg-muted/80 transition-all border border-border"
                    >
                        <History size={14} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Log</span>
                    </button>
                    <button 
                        onClick={() => handleOpenFeedback(surat)}
                        className={cn(
                            "h-10 flex items-center justify-center gap-2 rounded-xl transition-all shadow-sm group/pic",
                            (surat.pic_feedback || surat.pic_attachment) ? "bg-primary text-white" : "bg-background border border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                        )}
                    >
                        <Paperclip size={14} className="group-hover/pic:rotate-12 transition-transform" />
                        <span className="text-[9px] font-black uppercase tracking-widest">PIC Control</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL FEEDBACK + ATTACHMENT */}
      <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
        <DialogContent className="max-w-md p-0 bg-card border-none rounded-3xl overflow-hidden shadow-2xl font-sans">
          <DialogHeader className="p-6 bg-primary/5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <MessageSquare size={20} />
              </div>
              <div>
                <DialogTitle className="text-lg font-black uppercase tracking-tight">PIC Control Center</DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Input instruksi & lampiran pendukung
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Catatan Feedback</label>
              <Textarea 
                placeholder="Tulis instruksi revisi atau catatan untuk penandatangan..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                className="min-h-[120px] bg-muted/20 border-border rounded-2xl resize-none text-sm p-4 font-medium focus:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Upload File Pendukung</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all",
                  attachmentFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
                )}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && file.size > 10 * 1024 * 1024) {
                      toast.error("File terlalu besar (Maks 10MB)");
                      return;
                    }
                    setAttachmentFile(file || null);
                  }}
                />
                {attachmentFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 text-primary font-bold text-xs bg-white px-4 py-2 rounded-xl border border-primary/20 shadow-sm">
                      <FileCheck size={16} />
                      <span className="truncate max-w-[180px]">{attachmentFile.name}</span>
                      <X size={16} className="text-destructive cursor-pointer hover:scale-110" onClick={(e) => { e.stopPropagation(); setAttachmentFile(null); }} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground">
                       <Paperclip size={24} />
                    </div>
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Pilih file pendukung</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 bg-muted/20 border-t border-border gap-2">
            <Button variant="ghost" onClick={() => setIsFeedbackOpen(false)} className="rounded-xl font-bold uppercase text-[10px]">Tutup</Button>
            <Button 
              disabled={updateFeedbackMutation.isPending || isUploading}
              onClick={() => updateFeedbackMutation.mutate({ id: feedbackTarget?.id, feedback: feedbackText, file: attachmentFile })}
              className="rounded-xl font-black uppercase text-[10px] gap-2 bg-primary px-8"
            >
              {(updateFeedbackMutation.isPending || isUploading) ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL AUDIT TRAIL LENGKAP */}
      <Dialog open={!!selectedSurat} onOpenChange={() => setSelectedSurat(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-card border-border rounded-2xl shadow-2xl">
          <DialogHeader className="p-6 border-b border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 p-2 rounded-lg"><History className="text-primary" size={20} /></div>
                <div>
                  <DialogTitle className="text-sm font-black uppercase tracking-tight">Audit Trail & History</DialogTitle>
                  <DialogDescription className="text-[10px] font-medium uppercase text-muted-foreground">
                    Log aktivitas digital surat
                  </DialogDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                    onClick={() => handleOpenPreview(selectedSurat?.file_path)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary hover:text-white transition-all"
                >
                    <Download size={14} />
                    <span className="text-[9px] font-black uppercase">Unduh Dokumen</span>
                </button>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 max-h-[70vh] overflow-y-auto">
             {/* PIC INSTRUCTION CARD */}
             {(selectedSurat?.pic_feedback || selectedSurat?.pic_attachment) && (
              <div className="p-5 rounded-2xl border-2 border-primary/20 bg-primary/5 relative mb-10 shadow-inner">
                <div className="absolute -top-3 left-5 bg-primary text-white text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest">
                  PIC Feedback & Attachment
                </div>
                {selectedSurat?.pic_feedback && (
                  <p className="text-xs font-bold text-foreground leading-relaxed italic mb-4 pr-4">
                    "{selectedSurat.pic_feedback}"
                  </p>
                )}
                {selectedSurat?.pic_attachment && (
                  <a 
                    href={selectedSurat.pic_attachment} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-primary/20 rounded-xl text-[10px] font-black text-primary hover:bg-primary hover:text-white transition-all uppercase shadow-sm"
                  >
                    <Download size={14} /> Unduh Lampiran PIC
                  </a>
                )}
              </div>
            )}

            <div className="space-y-8 relative pt-2">
              <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-border" />
              {[...(selectedSurat?.surat_signatures || [])].sort((a,b) => a.step_order - b.step_order).map((sig) => (
                <div key={sig.id} className="relative pl-12">
                  <div className={cn(
                    "absolute left-0 w-8 h-8 rounded-full flex items-center justify-center z-10 shadow-sm border-4 border-background transition-colors",
                    sig.is_signed ? "bg-emerald-500 text-white" : 
                    sig.status === 'REJECTED' ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"
                  )}>
                    {sig.is_signed ? <CheckCircle2 size={12} /> : <span className="text-[10px] font-bold">{sig.step_order}</span>}
                  </div>
                  
                  <div className={cn(
                    "p-4 rounded-xl border transition-all space-y-3",
                    sig.is_signed ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card shadow-sm"
                  )}>
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <div className="text-[11px] font-black uppercase tracking-tight flex items-center gap-2">
                          {sig.role_name}
                          {sig.is_signed && <Badge className="bg-emerald-500 text-white text-[8px] h-4 uppercase px-1 shadow-none">Approved</Badge>}
                          {sig.status === 'REJECTED' && <Badge variant="destructive" className="text-[8px] h-4 uppercase px-1 shadow-none">Rejected</Badge>}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] text-muted-foreground font-medium uppercase">
                          <span className="flex items-center gap-1"><User size={10} /> {(sig.profiles as any)?.full_name || 'Menunggu Antrian...'}</span>
                          <span className="flex items-center gap-1"><Clock size={10} /> {formatDateTime(sig.signed_at)}</span>
                        </div>
                      </div>
                    </div>

                    {sig.catatan && (
                      <div className="bg-background/50 p-2.5 rounded-lg border border-border/50 shadow-inner">
                        <p className="text-[10px] italic text-muted-foreground leading-relaxed">
                          <MessageSquare size={10} className="inline mr-1 opacity-50" />
                          "{sig.catatan}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
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

export default MonitoringPICPage;