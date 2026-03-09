import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import {
  Wallet, Search, Loader2, Inbox, X, Clock, CheckCircle2,
  XCircle, User, FileText, ExternalLink, Send, Paperclip,
  RotateCcw, ShieldCheck, MessageSquare, Building2, LockOpen, Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from 'react-hot-toast';

// ── Types ──────────────────────────────────────────────────────────────
interface FinanceSurat {
  id: string;
  no_surat: string;
  judul_surat: string;
  file_path: string | null;
  pic_attachment: string | null;
  status: string;
  pic_review_status: string | null;
  finance_status: string | null;
  finance_note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string } | null;
}

interface ChatMessage {
  id: string;
  surat_id: string;
  sender_id: string;
  sender_name: string | null;
  sender_role: string;
  message: string;
  attachment_url: string | null;
  is_system: boolean;
  created_at: string;
}

// ── Badge helper ─────────────────────────────────────────────────────
const getStatusBadge = (status: string | null) => {
  switch (status) {
    case 'KEUANGAN_DONE':    return { label: 'Disetujui',  cls: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20', Icon: CheckCircle2 };
    case 'KEUANGAN_REJECTED':return { label: 'Ditolak',    cls: 'text-red-600 bg-red-500/10 border-red-500/20',           Icon: XCircle };
    case 'KEUANGAN':         return { label: 'Perlu Review',cls: 'text-amber-600 bg-amber-500/10 border-amber-500/20',    Icon: Clock };
    default:                 return { label: 'Menunggu',   cls: 'text-slate-500 bg-slate-500/10 border-slate-500/20',     Icon: Clock };
  }
};

// ── Main Component ───────────────────────────────────────────────────
const FinanceReviewPage = () => {
  const queryClient = useQueryClient();
  const [selectedSurat, setSelectedSurat] = useState<FinanceSurat | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string } | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isActing, setIsActing] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('id, full_name').eq('id', user.id).single()
        .then(({ data }) => setCurrentUser(data));
    });
  }, []);

  // Fetch queue
  const { data: queue = [], isLoading, refetch } = useQuery({
    queryKey: ['finance-queue'],
    queryFn: async (): Promise<FinanceSurat[]> => {
      const { data, error } = await supabase
        .from('surat_registrasi')
        .select(`
          id, no_surat, judul_surat, file_path, pic_attachment,
          status, pic_review_status, finance_status, finance_note,
          created_by, created_at, updated_at,
          profiles:created_by(full_name)
        `)
        .eq('pic_review_status', 'KEUANGAN')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as FinanceSurat[];
    },
    enabled: !!currentUser,
  });

  // Load chat when surat selected
  useEffect(() => {
    if (!selectedSurat?.id) return;
    supabase.from('surat_chats')
      .select('id, surat_id, sender_id, sender_name, sender_role, message, attachment_url, is_system, created_at')
      .eq('surat_id', selectedSurat.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => setMessages((data || []) as ChatMessage[]));
  }, [selectedSurat?.id]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Realtime: new surat
  useEffect(() => {
    const channel = supabase
      .channel('finance-queue-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'surat_registrasi' }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  // Realtime: chat messages
  useEffect(() => {
    if (!selectedSurat?.id) return;
    const ch = supabase
      .channel(`finance-chat:${selectedSurat.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'surat_chats',
        filter: `surat_id=eq.${selectedSurat.id}`
      }, (payload) => {
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new as ChatMessage];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedSurat?.id]);

  const getFileUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return supabase.storage.from('surat-docs').getPublicUrl(path).data.publicUrl;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !attachment || !selectedSurat) return;
    setIsSending(true);
    try {
      let fileUrl: string | null = null;
      if (attachment) {
        const filePath = `finance_chat/${Date.now()}-${attachment.name}`;
        await supabase.storage.from('surat-docs').upload(filePath, attachment);
        fileUrl = supabase.storage.from('surat-docs').getPublicUrl(filePath).data.publicUrl;
      }
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', currentUser!.id).single();
      await supabase.from('surat_chats').insert({
        surat_id: selectedSurat.id,
        sender_id: currentUser!.id,
        sender_name: profile?.full_name ?? 'Finance',
        sender_role: 'pic',
        message: newMessage.trim(),
        attachment_url: fileUrl,
        is_system: false,
      });
      setNewMessage('');
      setAttachment(null);
    } catch (err: any) {
      toast.error('Gagal mengirim pesan');
    } finally {
      setIsSending(false);
    }
  };

  const handleFinanceAction = async (action: 'KEUANGAN_DONE' | 'KEUANGAN_REJECTED') => {
    if (!selectedSurat || !currentUser) return;
    const label = action === 'KEUANGAN_DONE' ? 'SETUJUI' : 'TOLAK';
    const note = prompt(`Catatan untuk ${label} (opsional):`);
    if (note === null) return;
    setIsActing(true);
    const toastId = toast.loading('Memproses...');
    try {
      const { error } = await supabase
        .from('surat_registrasi')
        .update({
          finance_status: action,
          finance_note: note || null,
          pic_review_status: action,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedSurat.id);
      if (error) throw error;

      // System message
      await supabase.from('surat_chats').insert({
        surat_id: selectedSurat.id,
        sender_id: currentUser.id,
        sender_name: 'Sistem',
        sender_role: 'system',
        message: action === 'KEUANGAN_DONE'
          ? `✅ Tim Keuangan menyetujui dokumen ini.${note ? ` Catatan: ${note}` : ''}`
          : `❌ Tim Keuangan menolak dokumen ini.${note ? ` Alasan: ${note}` : ''}`,
        is_system: true,
      });

      toast.success(action === 'KEUANGAN_DONE' ? 'Dokumen disetujui' : 'Dokumen ditolak', { id: toastId });
      setSelectedSurat(null);
      queryClient.invalidateQueries({ queryKey: ['finance-queue'] });
    } catch (err: any) {
      toast.error(err.message || 'Gagal memproses', { id: toastId });
    } finally {
      setIsActing(false);
    }
  };

  const filtered = queue.filter(item =>
    item.judul_surat?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.no_surat?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Toaster position="top-right" />

      {/* HEADER */}
      <header className="px-6 py-4 border-b border-border bg-card/50 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-xl font-black tracking-tighter text-primary flex items-center gap-2">
                <Wallet size={20} /> ANTREAN REVIEW KEUANGAN
              </h1>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border bg-primary/10 text-primary border-primary/20">
                {queue.length} Menunggu
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
              Dokumen yang diteruskan PIC untuk persetujuan keuangan
            </p>
          </div>
          <div className="relative min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Cari dokumen atau nomor surat..."
              className="w-full pl-10 pr-4 py-2 bg-secondary/50 border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main className="flex-1 flex overflow-hidden">

        {/* QUEUE LIST */}
        <div className="w-[350px] lg:w-[400px] shrink-0 flex flex-col border-r border-border bg-card/10">
          <div className="p-4 border-b border-border bg-secondary/5 flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Inbox size={12} /> Antrean ({filtered.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="animate-spin text-primary mb-2" size={24} />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Memuat...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center opacity-40">
                <Wallet className="mx-auto mb-4" size={40} />
                <p className="text-xs font-bold uppercase tracking-tight">Tidak ada antrean</p>
                <p className="text-[10px] text-muted-foreground mt-1">Semua dokumen sudah diproses</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {filtered.map(item => {
                  const badge = getStatusBadge(item.pic_review_status);
                  const isActive = selectedSurat?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedSurat(item)}
                      className={`p-4 cursor-pointer transition-all hover:bg-secondary/40 flex gap-3 relative border-l-2 ${
                        isActive ? 'bg-secondary border-primary' : 'border-transparent'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1.5">
                          <div className={`flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded border ${badge.cls}`}>
                            <badge.Icon size={10} /> {badge.label}
                          </div>
                          <span className="text-[9px] text-muted-foreground font-mono">
                            {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true, locale: localeID })}
                          </span>
                        </div>
                        <h3 className={`text-sm font-bold truncate ${isActive ? 'text-primary' : ''}`}>{item.judul_surat}</h3>
                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5 opacity-70">{item.no_surat || '—'}</p>
                        {(item.profiles as any)?.full_name && (
                          <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-1">
                            <User size={9} /> {(item.profiles as any).full_name}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* DETAIL PANEL */}
        <div className="flex-1 bg-secondary/5 relative overflow-hidden">
          {selectedSurat ? (
            <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">

              {/* Close Button */}
              <button
                onClick={() => setSelectedSurat(null)}
                className="absolute top-4 right-4 z-50 p-2 bg-background/80 backdrop-blur shadow-sm border border-border rounded-full text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>

              {/* Document Header */}
              <div className="px-6 py-5 bg-card border-b border-border">
                <h2 className="text-base font-black uppercase tracking-tight pr-10">{selectedSurat.judul_surat}</h2>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{selectedSurat.no_surat}</p>

                {/* File Links */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {selectedSurat.file_path && (
                    <a href={getFileUrl(selectedSurat.file_path)!} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg bg-primary/5 text-primary border border-primary/20 hover:bg-primary/10 transition-colors">
                      <FileText size={11} /> Dokumen Asli <ExternalLink size={10} />
                    </a>
                  )}
                  {selectedSurat.pic_attachment && (
                    <a href={getFileUrl(selectedSurat.pic_attachment)!} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg bg-success/5 text-success border border-success/20 hover:bg-success/10 transition-colors">
                      <ShieldCheck size={11} /> File SPK <ExternalLink size={10} />
                    </a>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleFinanceAction('KEUANGAN_DONE')}
                    disabled={isActing}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase rounded-xl bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} /> Setujui
                  </button>
                  <button
                    onClick={() => handleFinanceAction('KEUANGAN_REJECTED')}
                    disabled={isActing}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase rounded-xl bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors disabled:opacity-50"
                  >
                    <XCircle size={14} /> Tolak
                  </button>
                </div>
              </div>

              {/* Chat Status Bar */}
              <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border-b bg-primary/5 text-primary border-primary/20">
                <LockOpen size={12} /> Diskusi aktif — Anda dapat mengirim pesan
              </div>

              {/* Chat Area */}
              <div className="flex-1 flex flex-col min-h-0 bg-background">
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-20 py-10">
                      <MessageSquare size={48} strokeWidth={1} className="mb-3" />
                      <p className="text-xs font-black uppercase tracking-widest">Belum Ada Diskusi</p>
                    </div>
                  )}

                  {messages.map(msg => {
                    if (msg.is_system) {
                      return (
                        <div key={msg.id} className="flex justify-center">
                          <div className="bg-muted/60 border border-border/50 rounded-full px-4 py-1.5 max-w-[85%]">
                            <p className="text-[10px] text-muted-foreground text-center">{msg.message}</p>
                          </div>
                        </div>
                      );
                    }
                    const isMe = msg.sender_id === currentUser?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in`}>
                        <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className="flex items-center gap-2 mb-1 px-1">
                            <span className={`text-[10px] font-extrabold uppercase tracking-widest ${isMe ? 'text-primary' : 'text-muted-foreground'}`}>
                              {msg.sender_name ?? 'Unknown'}
                            </span>
                            <span className="text-[9px] text-muted-foreground/50 font-mono">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className={`p-3.5 rounded-2xl border shadow-sm ${
                            isMe
                              ? 'bg-primary text-primary-foreground border-primary rounded-tr-none'
                              : 'bg-secondary text-secondary-foreground border-border rounded-tl-none'
                          }`}>
                            {msg.attachment_url && (
                              <a href={msg.attachment_url} target="_blank" rel="noreferrer"
                                className="mb-2 flex items-center gap-2 text-[10px] font-bold underline">
                                <Paperclip size={11} /> Lampiran
                              </a>
                            )}
                            <p className="text-[13px] leading-relaxed font-medium whitespace-pre-wrap">{msg.message}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Input Area */}
              <div className="p-4 bg-card border-t border-border">
                <form onSubmit={handleSendMessage} className="flex flex-col gap-3">
                  {attachment && (
                    <div className="flex items-center justify-between bg-primary/10 p-2.5 rounded-lg text-[10px] border border-primary/30 font-bold">
                      <span className="truncate flex items-center gap-2 text-primary"><Paperclip size={12} /> {attachment.name}</span>
                      <button type="button" onClick={() => setAttachment(null)} className="text-destructive"><X size={14} /></button>
                    </div>
                  )}
                  <div className="flex gap-2.5">
                    <label className="p-2.5 rounded-xl cursor-pointer bg-secondary hover:bg-accent border border-border transition-all">
                      <Paperclip size={18} />
                      <input type="file" className="hidden" onChange={e => setAttachment(e.target.files?.[0] || null)} />
                    </label>
                    <input
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      placeholder="Ketik pesan atau catatan..."
                      className="flex-1 border border-border rounded-xl px-4 text-sm outline-none bg-background focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground/50"
                    />
                    <button
                      type="submit"
                      disabled={isSending || (!newMessage.trim() && !attachment)}
                      className="bg-primary text-primary-foreground p-2.5 rounded-xl hover:opacity-90 disabled:opacity-40 transition-all"
                    >
                      {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-40">
              <div className="w-20 h-20 bg-card rounded-full flex items-center justify-center mb-6 border border-border">
                <Wallet className="text-muted-foreground/20" size={40} />
              </div>
              <h2 className="text-xs font-black tracking-[0.3em] text-muted-foreground uppercase">Pilih Dokumen</h2>
              <p className="text-[10px] text-muted-foreground/60 mt-2 font-bold uppercase tracking-widest">
                Klik daftar untuk memulai review keuangan
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FinanceReviewPage;