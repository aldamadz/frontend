import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { picService, ChatMessage } from '@/services/pic.service';
import {
  Send, Paperclip, X, Lock, LockOpen, MessageSquare,
  FileText, ExternalLink, Loader2, ChevronRight,
  CheckCircle2, Clock, XCircle, Inbox, Search,
  AlertCircle, Download
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

// ── Types ─────────────────────────────────────────────────────────────────

interface SuratItem {
  id: string;
  no_surat: string;
  judul_surat: string;
  status: string;
  pic_review_status: string | null;
  chat_status: 'OPEN' | 'CLOSED';
  chat_opened_at: string | null;
  updated_at: string;
  pic_id: string | null;
  created_by: string;
  pic_name?: string | null;
  dept_name?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const getStatusBadge = (surat: SuratItem) => {
  const r = surat.pic_review_status;
  if (r === 'SPK')      return { label: 'SPK Diterbitkan', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' };
  if (r === 'KEUANGAN') return { label: 'Tim Keuangan',    color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' };
  if (r === 'REJECTED') return { label: 'Ditolak PIC',     color: 'text-red-600 bg-red-500/10 border-red-500/20' };
  if (r === 'PENDING')  return { label: 'Review PIC',      color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' };
  if (surat.status === 'DONE') return { label: 'Menunggu PIC', color: 'text-slate-500 bg-slate-500/10 border-slate-500/20' };
  return { label: surat.status, color: 'text-muted-foreground bg-muted border-border' };
};

const StatusIcon = ({ surat }: { surat: SuratItem }) => {
  const r = surat.pic_review_status;
  if (r === 'SPK')      return <CheckCircle2 size={13} className="text-emerald-600" />;
  if (r === 'KEUANGAN') return <CheckCircle2 size={13} className="text-blue-600" />;
  if (r === 'REJECTED') return <XCircle size={13} className="text-red-600" />;
  if (r === 'PENDING')  return <Clock size={13} className="text-amber-600" />;
  return <Clock size={13} className="text-slate-400" />;
};

// ── Main Component ────────────────────────────────────────────────────────

const UserChatPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<SuratItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatStatus, setChatStatus] = useState<'OPEN' | 'CLOSED'>('CLOSED');
  const [newMessage, setNewMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string } | null>(null);
  const [search, setSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canSend = chatStatus === 'OPEN' && !isSending;

  // ── Auth ───────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('id, full_name').eq('id', user.id).single()
        .then(({ data }) => setCurrentUser(data));
    });
  }, []);

  // ── Realtime: update list saat chat_status berubah di DB ────────────────
  useEffect(() => {
    if (!currentUser) return;
    const ch = supabase
      .channel(`user-surat-list:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'surat_registrasi',
          filter: `created_by=eq.${currentUser.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          // Update item di list tanpa refetch penuh
          queryClient.setQueryData(
            ['user-chat-list', currentUser.id],
            (old: SuratItem[] | undefined) =>
              (old ?? []).map((s) =>
                s.id === updated.id
                  ? {
                      ...s,
                      chat_status: updated.chat_status,
                      pic_review_status: updated.pic_review_status,
                      updated_at: updated.updated_at,
                    }
                  : s
              )
          );
          // Juga update selected jika itu dokumen yang sama
          setSelected((prev) =>
            prev?.id === updated.id
              ? { ...prev, chat_status: updated.chat_status, pic_review_status: updated.pic_review_status }
              : prev
          );
          // Sync chat status panel
          if (selected?.id === updated.id) {
            setChatStatus(updated.chat_status);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentUser, queryClient, selected?.id]);

  // ── Fetch surat milik user (status DONE ke atas) ──────────────────────
  const { data: suratList = [], isLoading } = useQuery<SuratItem[]>({
    queryKey: ['user-chat-list', currentUser?.id],
    enabled: !!currentUser,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surat_registrasi')
        .select(`
          id, no_surat, judul_surat, status,
          pic_review_status, chat_status, chat_opened_at, updated_at, pic_id, created_by,
          pic_profile:profiles!surat_registrasi_pic_id_fkey(full_name),
          penggunaan:master_penggunaan_detail!surat_registrasi_penggunaan_id_fkey(
            master_forms(master_departments(name))
          )
        `)
        .eq('created_by', currentUser!.id)
        .eq('status', 'DONE')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        pic_name: s.pic_profile?.[0]?.full_name ?? null,
        dept_name: s.penggunaan?.master_forms?.master_departments?.name ?? null,
      }));
    },
  });

  const filtered = suratList.filter(s =>
    s.judul_surat?.toLowerCase().includes(search.toLowerCase()) ||
    s.no_surat?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Pilih surat ────────────────────────────────────────────────────────
  const handleSelect = useCallback(async (surat: SuratItem) => {
    setSelected(surat);
    setChatStatus(surat.chat_status ?? 'CLOSED');
    setMessages([]);
    const history = await picService.getChatHistory(surat.id);
    setMessages(history);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ── Sync chatStatus dari selected (realtime list update) ─────────────────
  useEffect(() => {
    if (selected) setChatStatus(selected.chat_status ?? 'CLOSED');
  }, [selected?.chat_status]);

  // ── Realtime: chat messages ────────────────────────────────────────────
  useEffect(() => {
    if (!selected) return;
    const ch = picService.subscribeChat(selected.id, (msg) => {
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
    });
    return () => { supabase.removeChannel(ch); };
  }, [selected?.id]);

  // ── Toast notif saat chat_status berubah (ditangani oleh channel list) ──
  const prevChatStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selected) return;
    const prev = prevChatStatusRef.current;
    const curr = selected.chat_status;
    if (prev !== null && prev !== curr) {
      if (curr === 'OPEN') {
        toast.success('PIC membuka sesi diskusi — Anda dapat mengirim pesan', { duration: 4000 });
      } else {
        toast('Sesi diskusi ditutup oleh PIC', { icon: '🔒', duration: 4000 });
      }
    }
    prevChatStatusRef.current = curr;
  }, [selected?.chat_status]);

  // ── Auto scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // ── Kirim pesan ────────────────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || (!newMessage.trim() && !attachment)) return;
    if (chatStatus !== 'OPEN') return toast.error('Chat masih tertutup, tunggu PIC membuka sesi');

    setIsSending(true);
    try {
      let fileUrl: string | null = null;
      if (attachment) {
        const path = `chat_attachments/${Date.now()}-${attachment.name}`;
        await supabase.storage.from('surat-docs').upload(path, attachment);
        fileUrl = supabase.storage.from('surat-docs').getPublicUrl(path).data.publicUrl;
      }
      await picService.sendMessage(selected.id, newMessage, fileUrl, 'creator');
      setNewMessage('');
      setAttachment(null);
    } catch (err: any) {
      toast.error(err.message?.includes('violates') ? 'Chat sudah tertutup' : 'Gagal mengirim pesan');
    } finally {
      setIsSending(false);
    }
  };

  const getFileUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return supabase.storage.from('surat-docs').getPublicUrl(path).data.publicUrl;
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">

      {/* ── SIDEBAR KIRI ── */}
      <div className="w-[320px] shrink-0 flex flex-col border-r border-border bg-card/20">
        
        {/* Header sidebar */}
        <div className="px-5 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare size={16} className="text-primary" />
            <h1 className="text-sm font-black uppercase tracking-[0.15em] text-foreground">
              Diskusi Dokumen
            </h1>
          </div>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
            Chat dengan PIC Departemen
          </p>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari dokumen..."
              className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-[11px] outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* List surat */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={20} className="animate-spin text-primary/40" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Memuat...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-30">
              <Inbox size={32} strokeWidth={1} />
              <p className="text-[10px] font-bold uppercase tracking-widest">Belum ada dokumen</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filtered.map((surat) => {
                const badge = getStatusBadge(surat);
                const isActive = selected?.id === surat.id;
                return (
                  <button
                    key={surat.id}
                    onClick={() => handleSelect(surat)}
                    className={`w-full text-left px-4 py-3.5 transition-all hover:bg-secondary/30 relative ${
                      isActive ? 'bg-primary/5 border-l-2 border-primary' : 'border-l-2 border-transparent'
                    }`}
                  >
                    {/* Indikator chat open */}
                    {surat.chat_status === 'OPEN' && (
                      <span className="absolute top-3 right-3 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    )}

                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className={`flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded border tracking-tight ${badge.color}`}>
                        <StatusIcon surat={surat} />
                        {badge.label}
                      </div>
                      <span className="text-[9px] text-muted-foreground/50 font-mono shrink-0">
                        {formatDistanceToNow(new Date(surat.updated_at), { addSuffix: true, locale: localeID })}
                      </span>
                    </div>

                    <p className={`text-[11px] font-bold truncate leading-tight mb-1 ${isActive ? 'text-primary' : 'text-foreground'}`}>
                      {surat.judul_surat}
                    </p>
                    <p className="text-[9px] font-mono text-muted-foreground/60 truncate">
                      {surat.no_surat}
                    </p>

                    {surat.pic_name && (
                      <p className="text-[9px] text-muted-foreground mt-1 truncate">
                        PIC: <span className="font-bold">{surat.pic_name}</span>
                        {surat.dept_name && ` · ${surat.dept_name}`}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── PANEL KANAN: CHAT ── */}
      {!selected ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-25 select-none">
          <MessageSquare size={56} strokeWidth={1} />
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em]">Pilih Dokumen</p>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-bold">
              untuk memulai diskusi dengan PIC
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Header chat */}
          <div className="px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-mono text-muted-foreground/60">{selected.no_surat}</span>
                  {selected.pic_review_status && (
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${getStatusBadge(selected).color}`}>
                      {getStatusBadge(selected).label}
                    </span>
                  )}
                </div>
                <h2 className="text-sm font-extrabold text-foreground uppercase tracking-tight truncate">
                  {selected.judul_surat}
                </h2>
                {selected.pic_name && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Ditangani: <span className="font-bold text-foreground/70">{selected.pic_name}</span>
                    {selected.dept_name && <span className="text-muted-foreground/50"> · {selected.dept_name}</span>}
                  </p>
                )}
              </div>

              {/* Indikator status chat */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider shrink-0 ${
                chatStatus === 'OPEN'
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  : 'bg-muted text-muted-foreground border-border'
              }`}>
                {chatStatus === 'OPEN'
                  ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live</>
                  : <><Lock size={11} /> Tertutup</>
                }
              </div>
            </div>
          </div>

          {/* Info banner chat status */}
          {chatStatus === 'CLOSED' && (
            <div className="mx-6 mt-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-3 shrink-0">
              <AlertCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider">
                  Menunggu PIC Membuka Sesi
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                  Anda belum dapat mengirim pesan. PIC akan membuka sesi diskusi ketika siap untuk berdiskusi.
                </p>
              </div>
            </div>
          )}

          {chatStatus === 'OPEN' && (
            <div className="mx-6 mt-4 p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center gap-2 shrink-0">
              <LockOpen size={13} className="text-emerald-600 shrink-0" />
              <p className="text-[10px] font-bold text-emerald-700">
                Sesi diskusi aktif — Anda dapat mengirim pesan kepada PIC
              </p>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 scroll-smooth">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-20">
                <MessageSquare size={48} strokeWidth={1} />
                <p className="text-[10px] font-black uppercase tracking-widest">Belum ada pesan</p>
              </div>
            )}

            {messages.map((msg) => {
              // Gunakan sender_role: 'creator' = kanan, 'pic' = kiri
            // Ini satu-satunya cara reliable jika created_by === pic_id
            const isMe = msg.sender_role === 'creator';

              // Pesan sistem
              if (msg.is_system) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <div className="bg-muted/50 border border-border/40 rounded-full px-4 py-1.5 max-w-[80%]">
                      <p className="text-[10px] text-muted-foreground text-center">{msg.message}</p>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1`}>
                  <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className={`text-[9px] font-black uppercase tracking-wider ${isMe ? 'text-primary' : 'text-muted-foreground'}`}>
                        {isMe ? 'Anda' : (msg.sender_name ?? 'PIC')}
                      </span>
                      <span className="text-[8px] text-muted-foreground/40 font-mono">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed font-medium whitespace-pre-wrap shadow-sm ${
                      isMe
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-card border border-border text-foreground rounded-tl-sm'
                    }`}>
                      {msg.attachment_url && (
                        <a
                          href={getFileUrl(msg.attachment_url)!}
                          target="_blank"
                          rel="noreferrer"
                          className={`flex items-center gap-2 mb-2 p-2 rounded-lg border text-[10px] font-bold uppercase ${
                            isMe ? 'bg-black/20 border-white/10' : 'bg-muted border-border'
                          }`}
                        >
                          <Paperclip size={11} /> Lampiran
                          <ExternalLink size={10} className="ml-auto" />
                        </a>
                      )}
                      {msg.message}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input area */}
          <div className="px-6 py-4 border-t border-border bg-card/30 shrink-0">
            {attachment && (
              <div className="flex items-center justify-between mb-3 bg-primary/10 border border-primary/20 px-3 py-2 rounded-lg">
                <span className="text-[10px] font-bold text-primary flex items-center gap-1.5 truncate">
                  <Paperclip size={12} /> {attachment.name}
                </span>
                <button onClick={() => setAttachment(null)} className="text-muted-foreground hover:text-destructive ml-2 shrink-0">
                  <X size={14} />
                </button>
              </div>
            )}

            <form onSubmit={handleSend} className="flex gap-2">
              {/* Lampiran */}
              <label className={`p-2.5 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                !canSend
                  ? 'bg-muted border-border opacity-40 cursor-not-allowed'
                  : 'bg-background border-border hover:bg-secondary cursor-pointer'
              }`}>
                <Paperclip size={18} className="text-muted-foreground" />
                <input type="file" className="hidden" disabled={!canSend} onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
              </label>

              {/* Input teks */}
              <input
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={!canSend}
                placeholder={chatStatus === 'OPEN' ? 'Ketik pesan untuk PIC...' : 'Menunggu PIC membuka sesi...'}
                className={`flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                  !canSend
                    ? 'bg-muted border-border text-muted-foreground cursor-not-allowed'
                    : 'bg-background border-border focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground/40'
                }`}
              />

              {/* Kirim */}
              <button
                type="submit"
                disabled={!canSend || (!newMessage.trim() && !attachment)}
                className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider flex items-center gap-2 disabled:opacity-40 transition-all hover:opacity-90 shrink-0"
              >
                {isSending
                  ? <Loader2 size={16} className="animate-spin" />
                  : <><Send size={15} /> Kirim</>
                }
              </button>
            </form>
          </div>

        </div>
      )}
    </div>
  );
};

export default UserChatPage;