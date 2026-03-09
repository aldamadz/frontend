import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { picService, ChatMessage } from '@/services/pic.service';
import { supabase } from '@/lib/supabase';
import {
  Send, ShieldCheck, CreditCard, RotateCcw, Loader2,
  Paperclip, X, ExternalLink, UploadCloud,
  FileCheck, Eye, MessageSquare, MoreVertical,
  FileText, User, LockOpen, Lock
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Props {
  surat: any;
  onActionComplete: () => void;
}

export const PICReviewDetail: React.FC<Props> = ({ surat: initialSurat, onActionComplete }) => {
  const queryClient = useQueryClient();

  // Surat state bisa berubah via realtime
  const [suratData, setSuratData] = useState<any>(initialSurat);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isTogglingChat, setIsTogglingChat] = useState(false);
  const [uploadingSPK, setUploadingSPK] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // PIC = user yang ada di master_dept_pics departemen form ini
  const deptPics = suratData?.penggunaan?.master_forms?.master_departments?.master_dept_pics ?? [];
  const isPIC = deptPics.some((dp: any) => dp.user_id === currentUser?.id) || !deptPics.length;
  const isChatOpen = suratData?.chat_status === 'OPEN';
  const canSend = isChatOpen && !isSending;

  // ── Auth ────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('id, full_name').eq('id', user.id).single()
        .then(({ data }) => setCurrentUser(data));
    });

    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync surat dari parent jika berganti
  useEffect(() => { setSuratData(initialSurat); }, [initialSurat]);

  // ── Load chat history + mark creator messages as read ───────────────────
  useEffect(() => {
    if (!suratData?.id) return;
    picService.getChatHistory(suratData.id).then(setMessages);

    // Mark semua pesan dari creator sebagai sudah dibaca PIC
    supabase
      .from('surat_chats')
      .update({ is_read: true })
      .eq('surat_id', suratData.id)
      .eq('sender_role', 'creator')
      .eq('is_read', false)
      .then(() => {}); // fire and forget
  }, [suratData?.id]);

  // ── Realtime: chat messages — juga mark read saat pesan baru masuk ──────
  useEffect(() => {
    if (!suratData?.id) return;
    const ch = picService.subscribeChat(suratData.id, (msg) => {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Jika pesan baru dari creator dan panel ini sedang terbuka, langsung mark read
      if (msg.sender_role === 'creator' && !msg.is_system) {
        supabase
          .from('surat_chats')
          .update({ is_read: true })
          .eq('id', msg.id)
          .then(() => {});
      }
    });
    return () => { supabase.removeChannel(ch); };
  }, [suratData?.id]);

  // ── Realtime: surat status (chat_status, pic_review_status) ─────────────
  useEffect(() => {
    if (!suratData?.id) return;
    const ch = picService.subscribeSuratStatus(suratData.id, (updated) => {
      setSuratData((prev: any) => ({ ...prev, ...updated }));
      // Jika ada aksi PIC final, refresh antrian
      if (updated.pic_review_status && updated.pic_review_status !== 'PENDING') {
        queryClient.invalidateQueries({ queryKey: ['review-queue'] });
        onActionComplete();
      }
    });
    return () => { supabase.removeChannel(ch); };
  }, [suratData?.id, queryClient, onActionComplete]);

  // ── Auto scroll ke bawah ─────────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getFileUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return supabase.storage.from('surat-docs').getPublicUrl(path).data.publicUrl;
  };

  // ── Toggle Chat (buka / tutup) ───────────────────────────────────────────
  const handleToggleChat = useCallback(async () => {
    if (!isPIC) return toast.error("Hanya PIC yang dapat membuka/menutup chat");
    setIsTogglingChat(true);
    try {
      if (isChatOpen) {
        await picService.closeChat(suratData.id);
        toast.success("Chat ditutup");
      } else {
        await picService.openChat(suratData.id);
        toast.success("Chat dibuka");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mengubah status chat");
    } finally {
      setIsTogglingChat(false);
    }
  }, [isPIC, isChatOpen, suratData?.id]);

  // ── Upload SPK ───────────────────────────────────────────────────────────
  const handleSPKUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSPK(true);
    setShowMenu(false);
    const toastId = toast.loading("Mengunggah SPK...");
    try {
      const fileName = `spk-${suratData.id}-${Date.now()}.${file.name.split('.').pop()}`;
      const filePath = `spk_files/${fileName}`;
      const { error: upErr } = await supabase.storage.from('surat-docs').upload(filePath, file);
      if (upErr) throw upErr;
      await picService.uploadSPK(suratData.id, filePath);
      setSuratData((prev: any) => ({ ...prev, pic_attachment: filePath }));
      toast.success("SPK berhasil diunggah", { id: toastId });
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
    } catch (err: any) {
      toast.error("Gagal mengunggah", { id: toastId });
    } finally {
      setUploadingSPK(false);
    }
  };

  // ── Kirim pesan ──────────────────────────────────────────────────────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !attachment) return;
    if (!isChatOpen) return toast.error("Chat sudah ditutup oleh PIC");
    setIsSending(true);
    try {
      let fileUrl: string | null = null;
      if (attachment) {
        const filePath = `chat_attachments/${Date.now()}-${attachment.name}`;
        await supabase.storage.from('surat-docs').upload(filePath, attachment);
        fileUrl = supabase.storage.from('surat-docs').getPublicUrl(filePath).data.publicUrl;
      }
      await picService.sendMessage(suratData.id, newMessage, fileUrl, 'pic');
      setNewMessage('');
      setAttachment(null);
    } catch (err: any) {
      toast.error(err.message?.includes('new row violates')
        ? "Chat sudah ditutup, tidak dapat mengirim pesan"
        : "Gagal mengirim pesan");
    } finally {
      setIsSending(false);
    }
  };

  // ── Aksi PIC final ───────────────────────────────────────────────────────
  const executeAction = async (action: 'REJECT' | 'SEND_SPK' | 'TO_FINANCE') => {
    if (action === 'SEND_SPK' && !suratData.pic_attachment) {
      return toast.error("File SPK belum diunggah!");
    }
    const label = action === 'REJECT' ? 'TOLAK' : action === 'TO_FINANCE' ? 'KE KEUANGAN' : 'KIRIM SPK';
    const note = prompt(`Tambahkan catatan untuk ${label} (opsional):`);
    if (note === null) return; // user cancel
    try {
      await picService.takeAction(suratData.id, action, note ?? '');
      toast.success("Aksi berhasil dilakukan");
      onActionComplete();
    } catch (err: any) {
      toast.error(err.message || "Aksi gagal");
    } finally {
      setShowMenu(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden border-l border-border relative">

      {/* HEADER */}
      <div className="p-4 border-b border-border bg-card/95 backdrop-blur-md shrink-0 flex items-center justify-between sticky top-0 z-10">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded flex items-center gap-1 shadow-glow">
              <User size={10} /> {suratData.profiles?.[0]?.full_name || 'PEMBUAT'}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono font-bold tracking-tight">
              | {suratData.no_surat}
            </span>
          </div>
          <h2 className="text-sm font-extrabold text-foreground truncate uppercase tracking-tight">
            {suratData.judul_surat}
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0" ref={menuRef}>
          {/* TOMBOL LIHAT DOKUMEN & LAMPIRAN */}
          <div className="flex items-center gap-1">
            {suratData.file_path && (
              <button
                onClick={() => window.open(getFileUrl(suratData.file_path)!, '_blank')}
                title="Lihat Dokumen"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 transition-all"
              >
                <Eye size={13} /> Dokumen
              </button>
            )}
            {suratData.lampiran_path && (
              <button
                onClick={() => window.open(getFileUrl(suratData.lampiran_path)!, '_blank')}
                title="Lihat Lampiran"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border bg-muted text-muted-foreground border-border hover:bg-accent transition-all"
              >
                <FileText size={13} /> Lampiran
              </button>
            )}
          </div>

          {/* TOMBOL BUKA / TUTUP CHAT — hanya tampil untuk PIC */}
          {isPIC && (
            <button
              onClick={handleToggleChat}
              disabled={isTogglingChat}
              title={isChatOpen ? "Tutup Chat" : "Buka Chat"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                isChatOpen
                  ? 'bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20'
                  : 'bg-success/10 text-success border-success/30 hover:bg-success/20'
              }`}
            >
              {isTogglingChat
                ? <Loader2 size={14} className="animate-spin" />
                : isChatOpen
                  ? <><Lock size={14} /> Tutup Chat</>
                  : <><LockOpen size={14} /> Buka Chat</>
              }
            </button>
          )}

          {/* MENU TITIK TIGA */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-accent rounded-full transition-all text-muted-foreground hover:text-foreground active:scale-90"
          >
            <MoreVertical size={20} />
          </button>

          {showMenu && (
            <div className="absolute right-4 top-16 w-64 bg-popover border border-border rounded-xl shadow-elevated z-[100] overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-2.5 border-b border-border bg-muted/30">
                <p className="text-[9px] font-black text-muted-foreground uppercase px-2 tracking-widest">
                  Manajemen Dokumen
                </p>
              </div>

              <div className="p-1.5">
                {suratData.file_path && (
                  <button
                    onClick={() => { window.open(getFileUrl(suratData.file_path)!, '_blank'); setShowMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold hover:bg-accent rounded-lg transition-colors"
                  >
                    <Eye size={16} className="text-primary" /> Lihat Draft Utama
                  </button>
                )}
                {suratData.lampiran_path && (
                  <button
                    onClick={() => { window.open(getFileUrl(suratData.lampiran_path)!, '_blank'); setShowMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold hover:bg-accent rounded-lg transition-colors"
                  >
                    <FileText size={16} className="text-primary" /> Lihat Lampiran
                  </button>
                )}

                <div className="h-px bg-border my-1.5" />

                {/* Upload / Lihat SPK */}
                {!suratData.pic_attachment ? (
                  <label className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold hover:bg-primary/10 rounded-lg cursor-pointer transition-colors text-primary">
                    {uploadingSPK ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                    Unggah SPK
                    <input type="file" className="hidden" onChange={handleSPKUpload} disabled={uploadingSPK} />
                  </label>
                ) : (
                  <>
                    <button
                      onClick={() => { window.open(getFileUrl(suratData.pic_attachment)!, '_blank'); setShowMenu(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold hover:bg-success/10 text-success rounded-lg transition-colors"
                    >
                      <FileCheck size={16} /> Lihat SPK Terunggah
                    </button>
                    <label className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold hover:bg-primary/10 rounded-lg cursor-pointer transition-colors text-primary">
                      <UploadCloud size={16} /> Ganti SPK
                      <input type="file" className="hidden" onChange={handleSPKUpload} disabled={uploadingSPK} />
                    </label>
                  </>
                )}

                <div className="h-px bg-border my-1.5" />

                {/* Aksi Final — hanya PIC */}
                {isPIC && (
                  <>
                    <button
                      onClick={() => executeAction('TO_FINANCE')}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold hover:bg-accent rounded-lg transition-colors"
                    >
                      <CreditCard size={16} className="text-blue-500" /> Teruskan ke Keuangan
                    </button>
                    <button
                      onClick={() => executeAction('SEND_SPK')}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold hover:bg-success/20 text-success rounded-lg transition-colors"
                    >
                      <ShieldCheck size={16} /> Kirim SPK (Finalisasi)
                    </button>
                    <button
                      onClick={() => executeAction('REJECT')}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold hover:bg-destructive/20 text-destructive rounded-lg transition-colors"
                    >
                      <RotateCcw size={16} /> Tolak Dokumen
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STATUS BAR CHAT */}
      <div className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border-b ${
        isChatOpen
          ? 'bg-success/10 text-success border-success/20'
          : 'bg-muted/40 text-muted-foreground border-border'
      }`}>
        {isChatOpen
          ? <><LockOpen size={12} /> Sesi diskusi aktif — Anda dapat mengirim pesan</>
          : <><Lock size={12} /> Chat tertutup — tunggu PIC membuka sesi diskusi</>
        }
      </div>

      {/* AREA CHAT */}
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-20 py-10">
              <MessageSquare size={64} strokeWidth={1} className="mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">Belum Ada Diskusi</p>
            </div>
          )}

          {messages.map((msg) => {
            // Gunakan sender_role: 'pic' = kanan, 'creator' = kiri
            const isMe = msg.sender_role === 'pic';
            const isSystem = msg.is_system;

            // Pesan sistem — center, style khusus
            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center animate-in fade-in">
                  <div className="bg-muted/60 border border-border/50 rounded-full px-4 py-1.5 max-w-[85%]">
                    <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                      {msg.message}
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}
              >
                <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className={`text-[10px] font-extrabold uppercase tracking-widest ${isMe ? 'text-primary' : 'text-muted-foreground'}`}>
                      {msg.sender_name ?? 'Unknown'}
                    </span>
                    <span className="text-[9px] text-muted-foreground/50 font-mono">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className={`p-3.5 rounded-2xl border shadow-sm transition-all ${
                    isMe
                      ? 'bg-primary text-primary-foreground border-primary rounded-tr-none'
                      : 'bg-secondary text-secondary-foreground border-border rounded-tl-none'
                  }`}>
                    {msg.attachment_url && (
                      <a
                        href={getFileUrl(msg.attachment_url)!}
                        target="_blank"
                        rel="noreferrer"
                        className={`mb-2.5 p-2 rounded-lg flex items-center justify-between gap-4 border transition-all ${
                          isMe
                            ? 'bg-black/20 border-white/10 hover:bg-black/30'
                            : 'bg-background/40 border-border/50 hover:bg-background/60'
                        }`}
                      >
                        <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                          <Paperclip size={12} /> Lampiran
                        </span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                    <p className="text-[13px] leading-relaxed font-medium whitespace-pre-wrap">
                      {msg.message}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* INPUT AREA */}
      <div className="p-4 bg-card border-t border-border sticky bottom-0">
        {/* Info jika chat tertutup */}
        {!isChatOpen && (
          <div className="mb-3 p-3 bg-muted/50 rounded-xl border border-border text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <Lock size={10} className="inline mr-1" />
              Chat ditutup — tidak dapat mengirim pesan
            </p>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex flex-col gap-3">
          {attachment && (
            <div className="flex items-center justify-between bg-primary/20 p-2.5 rounded-lg text-[10px] border border-primary/30 font-bold uppercase animate-in slide-in-from-bottom-2">
              <span className="truncate flex items-center gap-2 text-primary">
                <Paperclip size={14} /> {attachment.name}
              </span>
              <button type="button" onClick={() => setAttachment(null)} className="text-destructive hover:scale-110 transition-transform">
                <X size={16} />
              </button>
            </div>
          )}

          <div className="flex gap-2.5">
            <label className={`p-2.5 rounded-xl cursor-pointer transition-all border shadow-sm flex items-center justify-center shrink-0 active:scale-95 ${
              !canSend
                ? 'bg-muted text-muted-foreground border-border opacity-40 pointer-events-none'
                : 'bg-secondary text-secondary-foreground hover:bg-accent border-border'
            }`}>
              <Paperclip size={20} />
              <input
                type="file"
                className="hidden"
                disabled={!canSend}
                onChange={(e) => setAttachment(e.target.files?.[0] || null)}
              />
            </label>

            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={!canSend}
              placeholder={isChatOpen ? "Ketik pesan..." : "Chat tertutup..."}
              className={`flex-1 border rounded-xl px-4 text-sm outline-none transition-all font-medium ${
                !isChatOpen
                  ? 'bg-muted text-muted-foreground border-border cursor-not-allowed'
                  : 'bg-background border-border focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground/50'
              }`}
            />

            <button
              type="submit"
              disabled={!canSend || (!newMessage.trim() && !attachment)}
              className="bg-primary text-primary-foreground p-2.5 rounded-xl hover:opacity-90 disabled:opacity-40 transition-all shrink-0 flex items-center justify-center active:scale-95"
            >
              {isSending ? <Loader2 size={22} className="animate-spin" /> : <Send size={22} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};