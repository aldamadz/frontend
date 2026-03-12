import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { picService, ChatMessage } from '@/services/pic.service';
import {
  Send, Paperclip, X, MessageSquare,
  FileText, FileCheck, ExternalLink, Loader2,
  CheckCircle2, Clock, XCircle, Inbox, Search,
  AlertCircle, Download
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { useNotifSound } from '@/hooks/useNotifSound';

// ── Types ─────────────────────────────────────────────────────────────────

interface SuratItem {
  id: string;
  no_surat: string;
  judul_surat: string;
  status: string;
  pic_review_status: string | null;
  pic_attachment: string | null;
  pic_note: string | null;
  chat_status: 'OPEN' | 'CLOSED';
  chat_opened_at: string | null;
  updated_at: string;
  pic_id: string | null;
  created_by: string;
  pic_name?: string | null;
  dept_name?: string | null;
  file_path?: string | null;
  lampiran_path?: string | null;
  payment_file_path?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const getFileUrl = (path: string | null): string | null => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const bucket =
    path.startsWith('spk_files/') ? 'spk_files' :
    path.startsWith('payment_files/') ? 'payment_files' :
    path.startsWith('payment-') ? 'payment_files' :
    path.startsWith('chat_attachments/') ? 'chat_attachments' :
    path.startsWith('lampiran_') ? 'lampiran_surat' :
    'dokumen_surat';
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
};

const getStatusBadge = (surat: SuratItem) => {
  const r = surat.pic_review_status;
  if (r === 'SPK') return { label: 'SPK Diterbitkan', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' };
  if (r === 'KEUANGAN') return { label: 'Tim Keuangan', color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' };
  if (r === 'KEUANGAN_DONE') return { label: 'Keuangan Selesai', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' };
  if (r === 'KEUANGAN_REJECTED') return { label: 'Ditolak Keuangan', color: 'text-red-600 bg-red-500/10 border-red-500/20' };
  if (r === 'REJECTED') return { label: 'Ditolak PIC', color: 'text-red-600 bg-red-500/10 border-red-500/20' };
  if (r === 'PENDING') return { label: 'Review PIC', color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' };
  if (surat.status === 'DONE') return { label: 'Menunggu PIC', color: 'text-slate-500 bg-slate-500/10 border-slate-500/20' };
  return { label: surat.status, color: 'text-muted-foreground bg-muted border-border' };
};

const StatusIcon = ({ surat }: { surat: SuratItem }) => {
  const r = surat.pic_review_status;
  if (r === 'SPK') return <CheckCircle2 size={13} className="text-emerald-600" />;
  if (r === 'KEUANGAN') return <CheckCircle2 size={13} className="text-blue-600" />;
  if (r === 'KEUANGAN_DONE') return <CheckCircle2 size={13} className="text-emerald-600" />;
  if (r === 'KEUANGAN_REJECTED') return <XCircle size={13} className="text-red-600" />;
  if (r === 'REJECTED') return <XCircle size={13} className="text-red-600" />;
  if (r === 'PENDING') return <Clock size={13} className="text-amber-600" />;
  return <Clock size={13} className="text-slate-400" />;
};

const makePicNoteMsg = (surat: SuratItem): ChatMessage => ({
  id: `__pic_note__${surat.id}`,
  surat_id: surat.id,
  sender_id: surat.pic_id ?? '',
  sender_name: surat.pic_name ?? 'PIC',
  sender_role: 'pic',
  message: surat.pic_note ?? '',
  attachment_url: null,
  is_system: false,
  is_read: true,
  created_at: surat.updated_at,
});

// ── Main Component ────────────────────────────────────────────────────────

const UserChatPage: React.FC = () => {
  const queryClient = useQueryClient();
  const playNotif = useNotifSound();
  // Ref agar bisa dipanggil dari dalam useEffect tanpa stale closure / re-subscribe
  const playNotifRef = useRef(playNotif);
  useEffect(() => { playNotifRef.current = playNotif; }, [playNotif]);
  const [selected, setSelected] = useState<SuratItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatStatus, setChatStatus] = useState<'OPEN' | 'CLOSED'>('CLOSED');
  const [newMessage, setNewMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string } | null>(null);
  const [search, setSearch] = useState('');
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
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

  // ── Realtime: update list surat ───────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const ch = supabase
      .channel(`user-surat-list-sync:${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'surat_registrasi', filter: `created_by=eq.${currentUser.id}` },
        (payload) => {
          const updated = payload.new as any;
          queryClient.setQueryData(
            ['user-chat-list', currentUser.id],
            (old: SuratItem[] | undefined) =>
              (old ?? []).map((s) =>
                s.id === updated.id
                  ? { ...s, chat_status: updated.chat_status, pic_review_status: updated.pic_review_status, pic_attachment: updated.pic_attachment, pic_note: updated.pic_note, updated_at: updated.updated_at }
                  : s
              )
          );
          if (selected?.id === updated.id) {
            setChatStatus(updated.chat_status);
            setSelected((prev) => prev ? ({ ...prev, ...updated }) : null);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentUser, queryClient, selected?.id]);

  // ── Fetch surat milik user ────────────────────────────────────────────
  const { data: suratList = [], isLoading } = useQuery<SuratItem[]>({
    queryKey: ['user-chat-list', currentUser?.id],
    enabled: !!currentUser,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surat_registrasi')
        .select(`
          id, no_surat, judul_surat, status,
          pic_review_status, pic_note, chat_status, chat_opened_at, updated_at, pic_id, created_by,
          pic_attachment, file_path, lampiran_path,
          pic_profile:profiles!surat_registrasi_pic_id_fkey(full_name),
          penggunaan:master_penggunaan_detail!surat_registrasi_penggunaan_id_fkey(
            master_forms(master_departments(name))
          ),
          finance_reviews(payment_file_path, status)
        `)
        .eq('created_by', currentUser!.id)
        .eq('status', 'DONE')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        pic_name: s.pic_profile?.full_name ?? s.pic_profile?.[0]?.full_name ?? null,
        dept_name: s.penggunaan?.master_forms?.master_departments?.name ?? null,
        payment_file_path: s.finance_reviews?.[0]?.payment_file_path ?? null,
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
    setUnreadMap(prev => ({ ...prev, [surat.id]: 0 }));
    supabase.from('surat_chats')
      .update({ is_read: true })
      .eq('surat_id', surat.id)
      .eq('sender_role', 'pic')
      .eq('is_read', false)
      .eq('is_system', false)
      .then();

    const history = await picService.getChatHistory(surat.id);
    if (surat.pic_note) {
      const alreadyInHistory = history.some(m => m.id === `__pic_note__${surat.id}`);
      setMessages(alreadyInHistory ? history : [makePicNoteMsg(surat), ...history]);
    } else {
      setMessages(history);
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    if (selected) setChatStatus(selected.chat_status ?? 'CLOSED');
  }, [selected?.chat_status]);

  // ── Realtime: chat messages — bunyikan notif saat pesan dari PIC masuk ─
  const selectedRef = useRef<SuratItem | null>(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const ch = picService.subscribeChat(selected.id, (msg) => {
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
      // Bunyikan notif hanya untuk pesan dari PIC (bukan pesan sendiri, bukan sistem)
      if (msg.sender_role === 'pic' && !msg.is_system) {
        playNotifRef.current();
      }
    });
    return () => { supabase.removeChannel(ch); };
  }, [selected?.id]); // playNotif via ref — tidak perlu di deps

  // ── Unread badge dari PIC ─────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser || suratList.length === 0) return;
    const suratIds = suratList.map(s => s.id);

    const fetchUnread = async () => {
      const { data } = await supabase
        .from('surat_chats').select('surat_id')
        .in('surat_id', suratIds)
        .eq('sender_role', 'pic')
        .eq('is_read', false)
        .eq('is_system', false);
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { map[r.surat_id] = (map[r.surat_id] ?? 0) + 1; });
      setUnreadMap(map);
    };
    fetchUnread();

    const ch = supabase.channel(`user-chat-unread:${currentUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'surat_chats' }, (payload) => {
        const msg = payload.new as any;
        if (!suratIds.includes(msg.surat_id)) return;
        if (msg.sender_role !== 'pic' || msg.is_system) return;
        if (selectedRef.current?.id === msg.surat_id) {
          supabase.from('surat_chats').update({ is_read: true }).eq('id', msg.id).then();
        } else {
          // Bunyikan notif untuk surat yang tidak sedang terbuka
          playNotifRef.current();
          setUnreadMap(prev => ({ ...prev, [msg.surat_id]: (prev[msg.surat_id] ?? 0) + 1 }));
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'surat_chats' }, (payload) => {
        const msg = payload.new as any;
        const old = payload.old as any;
        if (!old.is_read && msg.is_read && msg.sender_role === 'pic') {
          setUnreadMap(prev => ({ ...prev, [msg.surat_id]: Math.max(0, (prev[msg.surat_id] ?? 0) - 1) }));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [currentUser, suratList]); // playNotif via ref — tidak perlu di deps

  // ── Sync pic_note ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!selected) return;
    setMessages(prev => {
      const noteId = `__pic_note__${selected.id}`;
      const withoutNote = prev.filter(m => m.id !== noteId);
      return selected.pic_note ? [makePicNoteMsg(selected), ...withoutNote] : withoutNote;
    });
  }, [selected?.pic_note]);

  // ── Toast notif saat chat_status berubah ──────────────────────────────
  const prevChatStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selected) return;
    const prev = prevChatStatusRef.current;
    const curr = selected.chat_status;
    if (prev !== null && prev !== curr) {
      if (curr === 'OPEN') {
        playNotifRef.current();
        toast.success('PIC membuka sesi diskusi — Anda dapat mengirim pesan', { duration: 4000 });
      } else {
        toast('Sesi diskusi ditutup oleh PIC', { icon: '🔒', duration: 4000 });
      }
    }
    prevChatStatusRef.current = curr;
  }, [selected?.chat_status]); // playNotif via ref — tidak perlu di deps

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
        await supabase.storage.from('chat_attachments').upload(path, attachment);
        fileUrl = path;
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

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">

      {/* ── SIDEBAR KIRI ── */}
      <div className="w-[320px] shrink-0 flex flex-col border-r border-border bg-card/20 backdrop-blur-xl">
        <div className="px-5 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare size={16} className="text-primary" />
            <h1 className="text-sm font-black uppercase tracking-[0.15em] text-foreground">Diskusi Dokumen</h1>
          </div>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Chat dengan PIC Departemen</p>
        </div>

        <div className="px-4 py-3 border-b border-border">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari dokumen..."
              className="w-full pl-8 pr-3 py-2 bg-background/50 border border-border rounded-lg text-[11px] font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/30">
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
            filtered.map((surat) => {
              const badge = getStatusBadge(surat);
              const isActive = selected?.id === surat.id;
              const unread = unreadMap[surat.id] ?? 0;
              return (
                <button
                  key={surat.id}
                  onClick={() => handleSelect(surat)}
                  className={`w-full text-left px-4 py-4 transition-all relative ${
                    isActive ? 'bg-primary/5 border-l-4 border-primary' : 'hover:bg-secondary/30 border-l-4 border-transparent'
                  }`}
                >
                  {unread > 0 && (
                    <span className="absolute top-3 right-3 min-w-[18px] h-[18px] flex items-center justify-center bg-primary text-primary-foreground text-[9px] font-black rounded-full px-1 animate-bounce">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className={`flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded border tracking-tight ${badge.color}`}>
                      <StatusIcon surat={surat} />
                      {badge.label}
                    </div>
                    <span className="text-[9px] text-muted-foreground/50 font-mono shrink-0">
                      {formatDistanceToNow(new Date(surat.updated_at), { addSuffix: true, locale: localeID })}
                    </span>
                  </div>
                  <p className={`text-[11px] font-black uppercase truncate leading-tight mb-1 ${isActive ? 'text-primary' : 'text-foreground'}`}>
                    {surat.judul_surat}
                  </p>
                  <p className="text-[9px] font-mono text-muted-foreground/60 truncate">{surat.no_surat}</p>
                  {surat.pic_name && (
                    <p className="text-[9px] text-muted-foreground mt-2 truncate font-bold uppercase">
                      PIC: <span className="text-foreground/70">{surat.pic_name}</span>
                      {surat.dept_name && ` · ${surat.dept_name}`}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── PANEL KANAN: CHAT ── */}
      <div className="flex-1 flex flex-col bg-background/50 relative overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-10 select-none">
            <MessageSquare size={80} strokeWidth={1} />
            <div className="text-center">
              <p className="text-sm font-black uppercase tracking-[0.3em]">Pilih Dokumen</p>
              <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest font-bold">Untuk memulai diskusi dengan PIC</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-hidden">

            {/* Header Chat */}
            <div className="px-8 py-5 border-b border-border bg-card/40 backdrop-blur-md flex justify-between items-center shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[9px] font-mono text-muted-foreground/60">{selected.no_surat}</span>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border tracking-tight ${getStatusBadge(selected).color}`}>
                    {getStatusBadge(selected).label}
                  </span>
                </div>
                <h2 className="text-sm font-black uppercase tracking-tight text-foreground truncate max-w-md">{selected.judul_surat}</h2>
                <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">
                  Ditangani: <span className="text-foreground/70">{selected.pic_name ?? 'N/A'}</span>
                </p>
              </div>
            </div>

            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 opacity-10">
                  <MessageSquare size={64} strokeWidth={1} />
                  <p className="text-[10px] font-black uppercase tracking-widest text-center">Belum ada diskusi terbuka<br/>untuk dokumen ini</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_id === currentUser?.id && msg.sender_role === 'creator' && !msg.id.startsWith('__pic_note__');
                  const isNote = msg.id.startsWith('__pic_note__');

                  if (msg.is_system) {
                    return (
                      <div key={msg.id} className="flex justify-center my-4 animate-in fade-in zoom-in duration-300">
                        <div className="bg-secondary/40 border border-border/50 rounded-full px-6 py-1.5 shadow-sm backdrop-blur-sm">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tight text-center">{msg.message}</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                      <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 mb-1.5 px-1">
                          <span className={`text-[9px] font-black uppercase tracking-widest ${isMe ? 'text-primary' : 'text-muted-foreground'}`}>
                            {isMe ? 'Anda' : (msg.sender_name ?? 'PIC')}
                          </span>
                          {isNote && (
                            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 tracking-tight">
                              Catatan
                            </span>
                          )}
                          <span className="text-[8px] font-mono text-muted-foreground/30">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className={`p-4 rounded-2xl shadow-sm text-xs font-bold leading-relaxed whitespace-pre-wrap transition-all ${
                          isMe
                            ? 'bg-primary text-primary-foreground rounded-tr-none'
                            : isNote
                              ? 'bg-amber-500/5 border-2 border-dashed border-amber-500/20 text-foreground rounded-tl-none'
                              : 'bg-card border border-border text-foreground rounded-tl-none backdrop-blur-sm'
                        }`}>
                          {msg.attachment_url && (
                            <a
                              href={getFileUrl(msg.attachment_url) ?? '#'}
                              target="_blank"
                              rel="noreferrer"
                              className={`flex items-center gap-2 mb-3 p-2.5 rounded-lg border text-[10px] font-black uppercase transition-all ${
                                isMe ? 'bg-black/20 border-white/10 hover:bg-black/30' : 'bg-muted border-border hover:bg-accent'
                              }`}
                            >
                              <Paperclip size={12} /> Lampiran <ExternalLink size={10} className="ml-auto opacity-40" />
                            </a>
                          )}
                          {msg.message}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sticky Banners + File Buttons */}
            <div className="px-8 space-y-2 mb-4 shrink-0">
              <div className="flex flex-wrap gap-2">
                {selected.file_path && (
                  <a href={selected.file_path} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 transition-all">
                    <FileText size={12} /> Dokumen
                  </a>
                )}
                {selected.lampiran_path && (
                  <a href={selected.lampiran_path} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border bg-violet-500/5 text-violet-500 border-violet-500/20 hover:bg-violet-500/10 transition-all">
                    <Paperclip size={12} /> Lampiran
                  </a>
                )}
                {selected.pic_attachment && (
                  <a href={getFileUrl(selected.pic_attachment) ?? '#'} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border bg-emerald-500/5 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10 transition-all">
                    <FileCheck size={12} /> SPK
                  </a>
                )}
                {selected.payment_file_path && (
                  <a href={getFileUrl(selected.payment_file_path) ?? '#'} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border bg-blue-500/5 text-blue-600 border-blue-500/20 hover:bg-blue-500/10 transition-all">
                    <Download size={12} /> Bukti Bayar
                  </a>
                )}
              </div>
              {chatStatus === 'CLOSED' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 animate-in slide-in-from-bottom-2">
                  <AlertCircle size={16} className="text-amber-600 shrink-0" />
                  <p className="text-[10px] font-black uppercase text-amber-700 tracking-tight">
                    Menunggu PIC membuka sesi untuk dapat berdiskusi
                  </p>
                </div>
              )}
            </div>

            {/* Input Footer */}
            <div className="p-8 bg-card/30 border-t border-border backdrop-blur-md shrink-0">
              {attachment && (
                <div className="mb-4 flex items-center gap-2 text-[10px] font-black text-primary bg-primary/10 w-fit px-4 py-2 rounded-full border border-primary/20 animate-in zoom-in">
                  <Paperclip size={12} /> {attachment.name}
                  <button onClick={() => setAttachment(null)} className="ml-2 hover:text-destructive transition-colors">
                    <X size={14} />
                  </button>
                </div>
              )}
              <form onSubmit={handleSend} className="flex gap-3">
                <label className={`p-4 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                  !canSend ? 'bg-muted opacity-40 cursor-not-allowed' : 'bg-background hover:bg-secondary cursor-pointer active:scale-95'
                }`}>
                  <Paperclip size={20} className="text-muted-foreground" />
                  <input type="file" className="hidden" disabled={!canSend} onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
                </label>
                <input
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={!canSend}
                  placeholder={chatStatus === 'OPEN' ? "Ketik pesan diskusi..." : "Sesi chat masih tertutup"}
                  className="flex-1 bg-background border border-border rounded-xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all disabled:opacity-50 placeholder:text-muted-foreground/30"
                />
                <button
                  type="submit"
                  disabled={!canSend || (!newMessage.trim() && !attachment)}
                  className="bg-primary text-primary-foreground px-10 py-4 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] hover:opacity-90 active:scale-95 transition-all disabled:opacity-30 shadow-lg shadow-primary/20"
                >
                  {isSending ? <Loader2 className="animate-spin" size={20} /> : "Kirim"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserChatPage;