import { Bell, Plus, Clock, FileCheck, Inbox, CheckCheck, Trash2, AlertCircle, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatDistanceToNow } from 'date-fns'
import { id as localeID } from 'date-fns/locale'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

interface Notification {
  id: string
  title: string
  description: string
  type: 'incoming' | 'stamped' | 'completed' | 'rejected' | 'feedback'
  time: Date
  isRead: boolean
  url?: string 
}

export const Header = ({ title, subtitle, onNewAgenda }: { title: string; subtitle?: string; onNewAgenda?: () => void }) => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const unreadCount = notifications.filter(n => !n.isRead).length
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // 1. Fungsi Tambah Notifikasi
  const addNotif = useCallback((n: Notification) => {
    setNotifications(prev => {
      if (prev.find(item => item.id === n.id)) return prev;
      
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((err) => console.log("Audio blocked:", err));
      }
      
      return [n, ...prev].slice(0, 50);
    });
  }, []);

  // 2. Fungsi Klik Notifikasi (Navigasi ke halaman yang ADA)
  const handleNotifClick = (n: Notification) => {
    setNotifications(prev => prev.map(item => item.id === n.id ? {...item, isRead: true} : item));
    
    if (n.url) {
      navigate(n.url);
    }
  };

  // 3. Setup Audio & Storage
  useEffect(() => {
    const saved = localStorage.getItem('surat_notifs')
    if (saved) {
      try {
        const parsed = JSON.parse(saved).map((n: any) => ({ ...n, time: new Date(n.time) }))
        setNotifications(parsed)
      } catch (e) { console.error("Load fail", e) }
    }

    const audio = new Audio('/sounds/notif.WAV');
    audio.preload = 'auto';
    audio.volume = 0.6;
    audioRef.current = audio;
  }, [])

  useEffect(() => {
    localStorage.setItem('surat_notifs', JSON.stringify(notifications))
  }, [notifications])

  // 4. REALTIME LOGIC
  useEffect(() => {
    let channel: any;

    const initRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user;
      if (!currentUser) return;

      channel = supabase.channel(`smart-notifs-${currentUser.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'surat_registrasi' 
        }, async (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;
          
          if (!newData || !newData.id) return;

          try {
            const isNew = payload.eventType === 'INSERT';
            const isStepUpdate = payload.eventType === 'UPDATE' && oldData && newData.current_step !== oldData.current_step;

            // A. NOTIF UNTUK PENANDATANGAN (Ke halaman Inbox)
            if (isNew || isStepUpdate) {
              if (isNew) await new Promise(resolve => setTimeout(resolve, 1200));

              const { data: myTurn } = await supabase
                .from('surat_signatures')
                .select('id, role_name')
                .eq('surat_id', newData.id)
                .eq('user_id', currentUser.id)
                .eq('step_order', Number(newData.current_step))
                .maybeSingle();

              if (myTurn) {
                addNotif({
                  id: `in-${newData.id}-${newData.current_step}`,
                  title: 'Permintaan Stamp Baru',
                  description: `Surat "${newData.judul_surat}" menunggu verifikasi Anda.`,
                  type: 'incoming',
                  time: new Date(),
                  isRead: false,
                  url: '/surat/inbox' // Diarahkan ke list inbox (pasti ada)
                });
                queryClient.invalidateQueries({ queryKey: ['surat-inbox'] });
              }
            }

            // B. LOGIKA UNTUK PEMBUAT (Ke halaman Monitoring)
            if (newData.created_by === currentUser.id && payload.eventType === 'UPDATE' && oldData) {
              
              // 1. Notif Feedback PIC
              if (newData.pic_feedback && newData.pic_feedback !== oldData.pic_feedback) {
                addNotif({
                  id: `fb-${newData.id}-${Date.now()}`,
                  title: 'Feedback PIC Baru',
                  description: `Catatan PIC: ${newData.pic_feedback}`,
                  type: 'feedback',
                  time: new Date(),
                  isRead: false,
                  url: '/surat/monitoring' // Diarahkan ke monitoring (pasti ada)
                });
              }

              // 2. Notif Status Dokumen
              if (newData.status === 'REJECTED' && oldData.status !== 'REJECTED') {
                addNotif({ id: `rej-${newData.id}-${Date.now()}`, title: 'Dokumen Ditolak', description: `Surat "${newData.judul_surat}" ditolak.`, type: 'rejected', time: new Date(), isRead: false, url: '/surat/monitoring' });
              } else if (newData.status === 'SELESAI' && oldData.status !== 'SELESAI') {
                addNotif({ id: `done-${newData.id}`, title: 'Dokumen Selesai!', description: `Surat "${newData.judul_surat}" disetujui sepenuhnya.`, type: 'completed', time: new Date(), isRead: false, url: '/surat/monitoring' });
              } else if (Number(newData.current_step) > Number(oldData.current_step)) {
                addNotif({ id: `step-${newData.id}-${newData.current_step}`, title: 'Update Progres', description: `Surat "${newData.judul_surat}" naik ke Step ${newData.current_step}.`, type: 'stamped', time: new Date(), isRead: false, url: '/surat/monitoring' });
              }
              
              queryClient.invalidateQueries({ queryKey: ['surat-list'] });
            }
          } catch (err) {
            console.error("Notif Error:", err);
          }
        })
        .subscribe();
    }

    initRealtime();
    return () => { if (channel) supabase.removeChannel(channel); }
  }, [addNotif, queryClient])

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-40 flex items-center justify-between px-6">
      <div className="flex flex-col">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest leading-none">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative group rounded-full">
              <Bell className={cn("w-5 h-5 transition-all", unreadCount > 0 ? "text-primary animate-ring" : "text-muted-foreground")} />
              {unreadCount > 0 && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-destructive rounded-full border-2 border-background" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 mr-4 rounded-2xl shadow-2xl border-border overflow-hidden" align="end">
            <div className="p-4 bg-muted/40 border-b flex justify-between items-center">
              <span className="text-[11px] font-black uppercase tracking-tighter">Notification Center</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setNotifications(prev => prev.map(n => ({...n, isRead: true})))}>
                  <CheckCheck className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setNotifications([])}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center gap-3">
                  <Inbox className="w-8 h-8 text-muted-foreground/20" />
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">No Activity</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div 
                    key={n.id} 
                    onClick={() => handleNotifClick(n)}
                    className={cn(
                      "p-4 border-b border-border/40 flex gap-3 cursor-pointer transition-all hover:bg-muted/30",
                      !n.isRead ? "bg-primary/[0.03]" : "opacity-60"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg h-fit",
                      n.type === 'incoming' ? "bg-blue-500/10 text-blue-600" : 
                      n.type === 'rejected' ? "bg-red-500/10 text-red-600" :
                      n.type === 'stamped' ? "bg-amber-500/10 text-amber-600" :
                      n.type === 'feedback' ? "bg-purple-500/10 text-purple-600" : 
                      "bg-emerald-500/10 text-emerald-600"
                    )}>
                      {n.type === 'incoming' && <Inbox className="w-4 h-4" />}
                      {n.type === 'rejected' && <AlertCircle className="w-4 h-4" />}
                      {n.type === 'stamped' && <Clock className="w-4 h-4" />}
                      {n.type === 'feedback' && <MessageSquare className="w-4 h-4" />}
                      {n.type === 'completed' && <FileCheck className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black leading-tight mb-1 uppercase tracking-tighter">{n.title}</p>
                      <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{n.description}</p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-[8px] text-muted-foreground/50 font-bold uppercase">
                          {formatDistanceToNow(n.time, { addSuffix: true, locale: localeID })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        {onNewAgenda && (
          <Button onClick={onNewAgenda} size="sm" className="gap-2 rounded-lg font-bold text-[11px] uppercase tracking-wider">
            <Plus className="w-4 h-4" /> New Request
          </Button>
        )}
      </div>
    </header>
  )
}