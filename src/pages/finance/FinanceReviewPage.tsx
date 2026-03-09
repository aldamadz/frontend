import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import {
  Search, Loader2, Inbox, MessageSquare, User, X,
  CheckCircle2, XCircle, Clock, FileText, Eye,
  Send, Paperclip, ExternalLink, AlertTriangle,
  Download, FileCheck, Lock, LockOpen, UploadCloud,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────────────────────
interface FinanceSurat {
  finance_review_id: string;
  finance_status: string;       // PENDING | IN_REVIEW | DONE | REJECTED
  finance_note: string | null;
  payment_file_path: string | null;
  surat_id: string;
  no_surat: string;
  judul_surat: string;
  file_path: string | null;
  pic_attachment: string | null;
  pic_review_status: string | null;
  created_by: string;
  updated_at: string;
  creator_name: string | null;
  unread_count: number;
}

interface ChatMsg {
  id: string;
  surat_id: string;
  sender_id: string;
  sender_name: string | null;
  sender_role: string;
  message: string;
  attachment_url: string | null;
  is_system: boolean;
  is_read: boolean;
  created_at: string;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'DONE':     return { label: 'Selesai',      cls: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20', Icon: CheckCircle2 };
    case 'REJECTED': return { label: 'Ditolak',      cls: 'text-red-600 bg-red-500/10 border-red-500/20',            Icon: XCircle };
    case 'IN_REVIEW':return { label: 'Sedang Review',cls: 'text-blue-600 bg-blue-500/10 border-blue-500/20',         Icon: Clock };
    default:         return { label: 'Menunggu',     cls: 'text-amber-600 bg-amber-500/10 border-amber-500/20',      Icon: Clock };
  }
};

const getFileUrl = (path: string | null) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const bucket =
    path.startsWith('spk_files/') ? 'spk_files' :
    path.startsWith('payment_files/') ? 'spk_files' :
    path.startsWith('chat_attachments/') ? 'chat_attachments' :
    path.startsWith('lampiran_') ? 'lampiran_surat' :
    'dokumen_surat';
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
};

// ── Component ────────────────────────────────────────────────────────────────
const FinanceReviewPage = () => {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selected, setSelected] = useState<FinanceSurat | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [uploadingPayment, setUploadingPayment] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('id, full_name, role').eq('id', user.id).single()
        .then(({ data }) => setCurrentUser(data));
    });
  }, []);

  // ── Fetch queue dari finance_reviews ─────────────────────────────────────
  const { data: queue = [], isLoading, refetch } = useQuery<FinanceSurat[]>({
    queryKey: ['finance-queue'],
    enabled: !!currentUser,
    queryFn: async () => {
      // Query finance_reviews join surat_registrasi
      const { data: reviews, error } = await supabase
        .from('finance_reviews')
        .select(`
          id,
          status,
          note,
          payment_file_path,
          surat_id,
          surat_registrasi!inner (
            no_surat, judul_surat, file_path, pic_attachment,
            pic_review_status, created_by, updated_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!reviews?.length) return [];

      // Ambil nama creator secara terpisah (hindari FK ambiguous)
      const creatorIds = [...new Set(reviews.map((r: any) =>
        Array.isArray(r.surat_registrasi)
          ? r.surat_registrasi[0]?.created_by
          : r.surat_registrasi?.created_by
      ).filter(Boolean))];

      const { data: profiles } = await supabase
        .from('profiles').select('id, full_name').in('id', creatorIds);
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));

      // Hitung unread per surat
      const suratIds = reviews.map((r: any) => r.surat_id);
      const { data: unreadData } = await supabase
        .from('surat_chats')
        .select('surat_id')
        .in('surat_id', suratIds)
        .eq('is_read', false)
        .eq('is_system', false)
        .neq('sender_role', 'system');

      const unreadMap = new Map<string, number>();
      (unreadData ?? []).forEach((c: any) => {
        unreadMap.set(c.surat_id, (unreadMap.get(c.surat_id) ?? 0) + 1);
      });

      return reviews.map((r: any) => {
        const sr = Array.isArray(r.surat_registrasi) ? r.surat_registrasi[0] : r.surat_registrasi;
        return {
          finance_review_id: r.id,
          finance_status: r.status,
          finance_note: r.note,
          payment_file_path: r.payment_file_path,
          surat_id: r.surat_id,
          no_surat: sr?.no_surat ?? '-',
          judul_surat: sr?.judul_surat ?? '-',
          file_path: sr?.file_path ?? null,
          pic_attachment: sr?.pic_attachment ?? null,
          pic_review_status: sr?.pic_review_status ?? null,
          created_by: sr?.created_by ?? '',
          updated_at: sr?.updated_at ?? r.created_at,
          creator_name: profileMap.get(sr?.created_by) ?? null,
          unread_count: unreadMap.get(r.surat_id) ?? 0,
        } as FinanceSurat;
      });
    },
  });

  // ── Load chat saat surat dipilih ──────────────────────────────────────────
  useEffect(() => {
    if (!selected?.surat_id) return;
    supabase.from('surat_chats')
      .select('id, surat_id, sender_id, sender_name, sender_role, message, attachment_url, is_system, is_read, created_at')
      .eq('surat_id', selected.surat_id)
      .order('created_at')
      .then(({ data }) => setMessages((data ?? []) as ChatMsg[]));

    // Mark pesan dari creator sebagai terbaca
    supabase.from('surat_chats')
      .update({ is_read: true })
      .eq('surat_id', selected.surat_id)
      .eq('is_read', false)
      .neq('sender_role', 'finance')
      .then(() => {
        window.dispatchEvent(new CustomEvent('chat-read'));
        queryClient.invalidateQueries({ queryKey: ['finance-queue'] });
      });
  }, [selected?.surat_id]);

  // ── Realtime chat ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selected?.surat_id) return;
    const ch = supabase.channel(`finance-chat:${selected.surat_id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'surat_chats',
        filter: `surat_id=eq.${selected.surat_id}`
      }, (payload) => {
        setMessages(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new as ChatMsg]);
        // Jika pesan bukan dari finance, mark read langsung
        if (payload.new.sender_role !== 'finance') {
          supabase.from('surat_chats').update({ is_read: true }).eq('id', payload.new.id).then(() => {});
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selected?.surat_id]);

  // ── Realtime queue ────────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel('finance-queue-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_reviews' }, () => refetch())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'surat_registrasi' }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  // ── Auto scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // ── Kirim pesan ───────────────────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !attachment || !selected || !currentUser) return;
    setIsSending(true);
    try {
      let fileUrl: string | null = null;
      if (attachment) {
        const filePath = `chat_attachments/${Date.now()}-${attachment.name}`;
        await supabase.storage.from('chat_attachments').upload(filePath, attachment);
        fileUrl = supabase.storage.from('chat_attachments').getPublicUrl(filePath).data.publicUrl;
      }
      await supabase.from('surat_chats').insert({
        surat_id: selected.surat_id,
        sender_id: currentUser.id,
        sender_name: currentUser.full_name,
        sender_role: 'finance',
        message: newMessage.trim(),
        attachment_url: fileUrl,
        is_system: false,
        is_read: true,
      });
      setNewMessage('');
      setAttachment(null);
    } catch { toast.error('Gagal mengirim pesan'); }
    finally { setIsSending(false); }
  };

  // ── Upload bukti pembayaran ───────────────────────────────────────────────
  const handleUploadPayment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    setUploadingPayment(true);
    const toastId = toast.loading('Mengunggah bukti pembayaran...');
    try {
      const filePath = `payment_files/${selected.surat_id}-${Date.now()}.${file.name.split('.').pop()}`;
      await supabase.storage.from('spk_files').upload(filePath, file);
      await supabase.from('finance_reviews')
        .update({ payment_file_path: filePath, updated_at: new Date().toISOString() })
        .eq('id', selected.finance_review_id);
      setSelected(prev => prev ? { ...prev, payment_file_path: filePath } : prev);
      toast.success('Bukti pembayaran diunggah', { id: toastId });
      refetch();
    } catch { toast.error('Gagal mengunggah', { id: toastId }); }
    finally { setUploadingPayment(false); }
  };

  // ── Aksi keuangan: Setujui / Tolak ───────────────────────────────────────
  const handleAction = async (action: 'DONE' | 'REJECTED') => {
    if (!selected || !currentUser) return;
    const note = prompt(action === 'DONE' ? 'Catatan persetujuan (opsional):' : 'Alasan penolakan (wajib):');
    if (note === null) return;
    if (action === 'REJECTED' && !note.trim()) return toast.error('Alasan penolakan wajib diisi');

    const toastId = toast.loading(action === 'DONE' ? 'Menyetujui...' : 'Menolak...');
    try {
      // Update finance_reviews
      await supabase.from('finance_reviews')
        .update({ status: action, note, action_by: currentUser.id, action_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', selected.finance_review_id);

      // Update surat_registrasi pic_review_status
      const newStatus = action === 'DONE' ? 'KEUANGAN_DONE' : 'KEUANGAN_REJECTED';
      await supabase.from('surat_registrasi')
        .update({ pic_review_status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', selected.surat_id);

      // System chat message
      await supabase.from('surat_chats').insert({
        surat_id: selected.surat_id,
        sender_id: currentUser.id,
        sender_name: currentUser.full_name,
        sender_role: 'system',
        is_system: true,
        is_read: true,
        message: action === 'DONE'
          ? `✅ Tim Keuangan menyetujui dokumen ini.${note ? ' Catatan: ' + note : ''}`
          : `❌ Tim Keuangan menolak dokumen ini. Alasan: ${note}`,
      });

      toast.success(action === 'DONE' ? 'Dokumen disetujui' : 'Dokumen ditolak', { id: toastId });
      setSelected(null);
      refetch();
    } catch { toast.error('Aksi gagal', { id: toastId }); }
  };

  const filtered = queue.filter(s =>
    s.judul_surat?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.no_surat?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingCount = queue.filter(s => s.finance_status === 'PENDING' || s.finance_status === 'IN_REVIEW').length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">

      {/* HEADER */}
      <header className="px-6 py-4 border-b border-border bg-card/50 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-xl font-black tracking-tighter text-primary">ANTREAN REVIEW KEUANGAN</h1>
              {pendingCount > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">
                  {pendingCount} perlu ditindak
                </span>
              )}
            </div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
              Dokumen yang diarahkan PIC ke Tim Keuangan
            </p>
          </div>
          <div className="relative min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              placeholder="Cari dokumen..."
              className="w-full pl-10 pr-4 py-2 bg-secondary/50 border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 flex overflow-hidden">

        {/* QUEUE LIST */}
        <div className="w-[360px] shrink-0 flex flex-col border-r border-border bg-card/10">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Inbox size={12} className="text-muted-foreground" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {filtered.length} Dokumen
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="animate-spin text-primary mb-2" size={24} />
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Memuat...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center opacity-40">
                <Inbox className="mx-auto mb-4" size={40} />
                <p className="text-xs font-bold uppercase">Tidak ada antrean</p>
                <p className="text-[10px] text-muted-foreground mt-1">Semua sudah diproses</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {filtered.map(item => {
                  const badge = getStatusBadge(item.finance_status);
                  const isActive = selected?.finance_review_id === item.finance_review_id;
                  return (
                    <div
                      key={item.finance_review_id}
                      onClick={() => setSelected(item)}
                      className={`p-4 cursor-pointer transition-all hover:bg-secondary/40 flex gap-3 relative border-l-2 ${
                        isActive ? 'bg-secondary border-primary' : 'border-transparent'
                      }`}
                    >
                      {/* Unread badge */}
                      {item.unread_count > 0 && (
                        <span className="absolute top-3 right-3 bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {item.unread_count}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1.5 pr-6">
                          <div className={`flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded border ${badge.cls}`}>
                            <badge.Icon size={10} /> {badge.label}
                          </div>
                          <span className="text-[9px] text-muted-foreground font-mono">
                            {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true, locale: localeID })}
                          </span>
                        </div>
                        <h3 className={`text-sm font-bold truncate ${isActive ? 'text-primary' : ''}`}>
                          {item.judul_surat}
                        </h3>
                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5 opacity-70">{item.no_surat}</p>
                        {item.creator_name && (
                          <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-1">
                            <User size={9} /> {item.creator_name}
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
        <div className="flex-1 relative overflow-hidden">
          {selected ? (
            <div className="flex flex-col h-full border-l border-border">
              {/* Header detail */}
              <div className="px-5 py-4 border-b border-border bg-card/95 shrink-0">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded flex items-center gap-1">
                        <User size={10} /> {selected.creator_name ?? 'PEMBUAT'}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono font-bold">{selected.no_surat}</span>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${getStatusBadge(selected.finance_status).cls}`}>
                        {getStatusBadge(selected.finance_status).label}
                      </span>
                    </div>
                    <h2 className="text-sm font-extrabold uppercase tracking-tight truncate">{selected.judul_surat}</h2>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {selected.file_path && (
                      <button onClick={() => window.open(getFileUrl(selected.file_path)!, '_blank')}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase border bg-primary/5 text-primary border-primary/20 hover:bg-primary/10">
                        <Eye size={12} /> Dokumen
                      </button>
                    )}
                    {selected.pic_attachment && (
                      <button onClick={() => window.open(getFileUrl(selected.pic_attachment)!, '_blank')}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase border bg-success/5 text-success border-success/20 hover:bg-success/10">
                        <FileCheck size={12} /> SPK
                      </button>
                    )}
                    {selected.payment_file_path && (
                      <button onClick={() => window.open(getFileUrl(selected.payment_file_path)!, '_blank')}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase border bg-blue-500/5 text-blue-500 border-blue-500/20 hover:bg-blue-500/10">
                        <Download size={12} /> Bukti
                      </button>
                    )}
                    <button onClick={() => setSelected(null)}
                      className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground">
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Action area — hanya jika belum selesai */}
                {(selected.finance_status === 'PENDING' || selected.finance_status === 'IN_REVIEW') && (
                  <div className="space-y-2">
                    {/* Upload bukti pembayaran */}
                    <div className="flex items-center justify-between p-2.5 bg-secondary/50 rounded-xl border border-border/50">
                      <div className="flex items-center gap-2">
                        {selected.payment_file_path ? (
                          <><CheckCircle2 size={14} className="text-success shrink-0" />
                          <span className="text-[10px] font-bold text-success">Bukti pembayaran diunggah</span></>
                        ) : (
                          <><AlertTriangle size={14} className="text-amber-500 shrink-0" />
                          <span className="text-[10px] font-bold text-muted-foreground">Unggah bukti pembayaran</span></>
                        )}
                      </div>
                      <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase cursor-pointer transition-all border ${
                        uploadingPayment ? 'opacity-50 pointer-events-none bg-muted border-border' : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
                      }`}>
                        {uploadingPayment ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                        {selected.payment_file_path ? 'Ganti' : 'Unggah'}
                        <input type="file" className="hidden" onChange={handleUploadPayment} disabled={uploadingPayment} />
                      </label>
                    </div>

                    {/* Tombol Setujui / Tolak */}
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handleAction('DONE')}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-xl border bg-success/10 text-success border-success/30 hover:bg-success/20 text-[10px] font-black uppercase tracking-wide transition-all active:scale-95">
                        <CheckCircle2 size={14} /> Setujui
                      </button>
                      <button onClick={() => handleAction('REJECTED')}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-xl border bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20 text-[10px] font-black uppercase tracking-wide transition-all active:scale-95">
                        <XCircle size={14} /> Tolak
                      </button>
                    </div>
                  </div>
                )}

                {(selected.finance_status === 'DONE' || selected.finance_status === 'REJECTED') && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-xl border border-border text-[10px] font-black uppercase text-muted-foreground">
                    <CheckCircle2 size={12} className="text-success" /> Dokumen sudah diproses
                    {selected.finance_note && <span className="ml-1 normal-case font-normal">— {selected.finance_note}</span>}
                  </div>
                )}
              </div>

              {/* Chat area */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full opacity-20">
                    <MessageSquare size={48} strokeWidth={1} className="mb-3" />
                    <p className="text-xs font-black uppercase tracking-widest">Belum Ada Diskusi</p>
                  </div>
                )}
                {messages.map(msg => {
                  const isMe = msg.sender_role === 'finance';
                  if (msg.is_system) {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <div className="bg-muted/60 border border-border/50 rounded-full px-4 py-1.5 max-w-[85%]">
                          <p className="text-[10px] text-muted-foreground text-center">{msg.message}</p>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 mb-1 px-1">
                          <span className={`text-[10px] font-extrabold uppercase tracking-widest ${isMe ? 'text-primary' : 'text-muted-foreground'}`}>
                            {msg.sender_name ?? 'Unknown'}
                          </span>
                          <span className="text-[9px] text-muted-foreground/50 font-mono">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className={`p-3 rounded-2xl border ${isMe
                          ? 'bg-primary text-primary-foreground border-primary rounded-tr-none'
                          : 'bg-secondary text-secondary-foreground border-border rounded-tl-none'}`}>
                          {msg.attachment_url && (
                            <a href={getFileUrl(msg.attachment_url)!} target="_blank" rel="noreferrer"
                              className={`mb-2 p-1.5 rounded-lg flex items-center justify-between gap-3 border ${isMe ? 'bg-black/20 border-white/10' : 'bg-background/40 border-border/50'}`}>
                              <span className="text-[9px] font-black uppercase flex items-center gap-1"><Paperclip size={10} /> Lampiran</span>
                              <ExternalLink size={10} />
                            </a>
                          )}
                          <p className="text-[13px] leading-relaxed font-medium whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border bg-card shrink-0">
                <form onSubmit={handleSend} className="flex flex-col gap-2">
                  {attachment && (
                    <div className="flex items-center justify-between bg-primary/20 p-2 rounded-lg text-[10px] border border-primary/30 font-bold uppercase">
                      <span className="truncate flex items-center gap-1 text-primary"><Paperclip size={12} /> {attachment.name}</span>
                      <button type="button" onClick={() => setAttachment(null)} className="text-destructive"><X size={14} /></button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <label className="p-2.5 rounded-xl cursor-pointer border bg-secondary border-border hover:bg-accent flex items-center justify-center shrink-0">
                      <Paperclip size={18} className="text-muted-foreground" />
                      <input type="file" className="hidden" onChange={e => setAttachment(e.target.files?.[0] || null)} />
                    </label>
                    <input
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      placeholder="Ketik pesan kepada pembuat..."
                      className="flex-1 border rounded-xl px-4 text-sm bg-background border-border outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button type="submit" disabled={isSending || (!newMessage.trim() && !attachment)}
                      className="bg-primary text-primary-foreground p-2.5 rounded-xl hover:opacity-90 disabled:opacity-40 flex items-center justify-center">
                      {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-40">
              <div className="w-20 h-20 bg-card rounded-full flex items-center justify-center mb-6 border border-border">
                <MessageSquare className="text-muted-foreground/20" size={40} />
              </div>
              <h2 className="text-xs font-black tracking-[0.3em] text-muted-foreground uppercase">Pilih Dokumen</h2>
              <p className="text-[10px] text-muted-foreground/60 mt-2 font-bold uppercase tracking-widest">
                Klik salah satu untuk mulai review
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FinanceReviewPage;