import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/lib/supabase";
import { 
  Search, AlertCircle, Loader2, 
  History, FileText, Clock,
  FileCheck, Filter, XCircle, CheckCircle2, MessageSquare, Send, Paperclip, X, Download
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pic-monitoring-list'] });
      toast.success("Feedback & Lampiran berhasil disimpan");
      setIsFeedbackOpen(false);
      setFeedbackText('');
      setAttachmentFile(null);
      setIsUploading(false);
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
    <div className="h-96 flex items-center justify-center border-2 border-dashed border-border rounded-3xl mt-10">
      <div className="text-center space-y-4">
        <AlertCircle className="mx-auto text-destructive animate-pulse" size={48} />
        <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">Gagal Memuat Data PIC</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-8 text-foreground font-sans">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm border border-primary/20">
              <FileCheck className="text-primary w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tighter uppercase">
                PIC MONITORING
              </h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.3em]">
                Enterprise Document Control Center
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <Input 
              placeholder="Cari Dokumen..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11 w-full sm:w-72 bg-card border-border rounded-xl text-xs font-bold"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 px-4 rounded-xl border border-border bg-card text-[10px] font-black uppercase outline-none min-w-[160px]"
          >
            <option value="all">SEMUA STATUS</option>
            <option value="PROSES">PROSES</option>
            <option value="SELESAI">SELESAI</option>
            <option value="REJECTED">DITOLAK</option>
          </select>
        </div>
      </div>

      {/* DATA GRID */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-64 bg-card/50 animate-pulse rounded-2xl border border-border" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((surat) => {
             const sigs = [...(surat.surat_signatures || [])].sort((a,b) => a.step_order - b.step_order);
             const currentSigner = sigs.find(s => s.step_order === surat.current_step);
             
             // Dynamic Colors for Queue/Status
             const isSelesai = surat.status === 'SELESAI';
             const isRejected = surat.status === 'REJECTED';

             return (
               <div key={surat.id} className="glass-card rounded-2xl p-6 group transition-all duration-300 relative border border-border hover:border-primary/40 bg-card flex flex-col">
                 <div className="flex justify-between items-start mb-5">
                    <Badge className={cn(
                      "text-[9px] font-black px-2.5 py-1 rounded-lg border",
                      isSelesai ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : 
                      isRejected ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    )}>
                      {surat.status}
                    </Badge>
                    {(surat.pic_feedback || surat.pic_attachment) && (
                      <div className="flex items-center gap-1 text-[8px] font-black text-primary animate-pulse">
                        <MessageSquare size={10} /> PIC UPDATED
                      </div>
                    )}
                 </div>

                 <div className="space-y-2 mb-6">
                    <h3 className="text-sm font-extrabold text-foreground line-clamp-2 uppercase leading-tight">
                      {surat.judul_surat}
                    </h3>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-mono text-muted-foreground bg-muted/50 w-fit px-2 py-0.5 rounded border border-border/50">
                        {surat.no_surat || 'PENDING-REF'}
                      </p>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">
                        • {new Date(surat.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                 </div>

                 {/* POSISI ANTRIAN SECTION */}
                 <div className="bg-muted/30 rounded-xl p-4 mb-6 border border-border/50 group-hover:bg-muted/50 transition-colors">
                    <div className={cn(
                      "flex items-center gap-2 text-[9px] font-black uppercase tracking-widest mb-1.5",
                      isSelesai ? "text-emerald-500" : isRejected ? "text-rose-500" : "text-amber-500"
                    )}>
                      <Clock size={12} className={cn(!isSelesai && !isRejected && "animate-pulse")} /> 
                      Posisi Antrian
                    </div>
                    <p className="text-xs font-bold text-foreground truncate">
                      {isSelesai ? 'Workflow Selesai' : isRejected ? 'Dokumen Ditolak' : (currentSigner?.role_name || 'Menunggu Plotting')}
                    </p>
                 </div>

                 <div className="mt-auto grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => setSelectedSurat(surat)}
                      className="h-10 flex items-center justify-center gap-2 bg-muted/30 border border-border rounded-xl hover:bg-muted font-bold text-[9px] uppercase transition-all"
                    >
                      <History size={14} className="text-primary" /> Log
                    </button>
                    <button 
                      onClick={() => handleOpenFeedback(surat)}
                      className={cn(
                        "h-10 flex items-center justify-center gap-2 rounded-xl border transition-all font-bold text-[9px] uppercase",
                        (surat.pic_feedback || surat.pic_attachment) ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-card border-border hover:bg-accent"
                      )}
                    >
                      <Paperclip size={14} /> PIC
                    </button>
                    <button 
                      onClick={() => handleOpenPreview(surat.file_path)}
                      className="h-10 flex items-center justify-center border border-border rounded-xl text-muted-foreground hover:bg-primary hover:text-white transition-colors"
                    >
                      <FileText size={18} />
                    </button>
                 </div>
               </div>
             )
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
                <DialogTitle className="text-lg font-black uppercase">PIC Control Center</DialogTitle>
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
                  onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                />
                {attachmentFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 text-primary font-bold text-xs bg-white px-4 py-2 rounded-xl border border-primary/20 shadow-sm">
                      <FileCheck size={16} />
                      <span className="truncate max-w-[180px]">{attachmentFile.name}</span>
                      <X size={16} className="text-destructive cursor-pointer hover:scale-110" onClick={(e) => { e.stopPropagation(); setAttachmentFile(null); }} />
                    </div>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">File siap diupload</span>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground">
                       <Paperclip size={24} />
                    </div>
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Klik atau tarik file ke sini</span>
                  </>
                )}
              </div>
              {feedbackTarget?.pic_attachment && !attachmentFile && (
                <p className="text-[9px] text-emerald-600 font-bold flex items-center gap-1.5 ml-1">
                  <CheckCircle2 size={10} /> Ada lampiran aktif di server
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="p-6 bg-muted/20 border-t border-border gap-2">
            <Button variant="ghost" onClick={() => setIsFeedbackOpen(false)} className="rounded-xl font-bold uppercase text-[10px]">Tutup</Button>
            <Button 
              disabled={updateFeedbackMutation.isPending || isUploading}
              onClick={() => updateFeedbackMutation.mutate({ id: feedbackTarget?.id, feedback: feedbackText, file: attachmentFile })}
              className="rounded-xl font-black uppercase text-[10px] gap-2 bg-primary px-8 shadow-lg shadow-primary/20"
            >
              {(updateFeedbackMutation.isPending || isUploading) ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL HISTORY */}
      <Dialog open={!!selectedSurat} onOpenChange={() => setSelectedSurat(null)}>
        <DialogContent className="max-w-2xl p-0 bg-card border-none shadow-2xl rounded-3xl overflow-hidden font-sans">
          <DialogHeader className="p-8 bg-muted/30 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-2xl text-primary border border-primary/20">
                <History size={24} />
              </div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Timeline & Tracking</DialogTitle>
                <p className="text-[10px] text-muted-foreground font-bold uppercase truncate max-w-sm mt-1 italic">
                  {selectedSurat?.judul_surat}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="p-8 max-h-[65vh] overflow-y-auto custom-scrollbar space-y-8">
            {/* PIC INSTRUCTION CARD - High Visibility */}
            {(selectedSurat?.pic_feedback || selectedSurat?.pic_attachment) && (
              <div className="p-5 rounded-2xl border-2 border-primary/20 bg-primary/5 relative mb-10">
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
                    <Download size={14} /> Download Lampiran PIC
                  </a>
                )}
              </div>
            )}

            {/* TIMELINE SIGNATURES */}
            <div className="space-y-8 relative">
              <div className="absolute left-[19px] top-2 bottom-2 w-[2px] bg-gradient-to-b from-primary/30 to-muted" />
              {[...(selectedSurat?.surat_signatures || [])].sort((a,b) => a.step_order - b.step_order).map((sig) => {
                const isSigned = sig.is_signed;
                const isRejected = sig.status === 'REJECTED';
                
                return (
                  <div key={sig.id} className="relative pl-12">
                    <div className={cn(
                      "absolute left-0 w-10 h-10 rounded-xl flex items-center justify-center z-10 border-4 border-card shadow-sm",
                      isSigned ? "bg-emerald-500 text-white" : isRejected ? "bg-rose-500 text-white" : "bg-muted text-muted-foreground"
                    )}>
                      {isSigned ? <CheckCircle2 size={16} /> : isRejected ? <XCircle size={16} /> : <span className="text-xs font-black">{sig.step_order}</span>}
                    </div>
                    <div className={cn(
                      "p-5 rounded-2xl border border-border bg-card transition-all",
                      isSigned && "border-emerald-500/10 bg-emerald-500/[0.02]",
                      isRejected && "border-rose-500/10 bg-rose-500/[0.02]"
                    )}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className={cn(
                            "text-xs font-black uppercase mb-0.5",
                            isSigned ? "text-emerald-600" : isRejected ? "text-rose-600" : "text-foreground"
                          )}>
                            {sig.role_name}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                            {(sig.profiles as any)?.full_name || 'Menunggu Konfirmasi'}
                          </p>
                        </div>
                        {sig.signed_at && <span className="text-[9px] font-mono font-bold text-muted-foreground">{formatDateTime(sig.signed_at)}</span>}
                      </div>
                      {sig.catatan && (
                        <div className="mt-3 p-3 bg-muted/40 rounded-lg border border-border/50 text-[11px] text-muted-foreground italic leading-relaxed">
                          "{sig.catatan}"
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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