import { Bell, Search, Plus, Clock, FileCheck, Inbox, CheckCheck, Trash2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatDistanceToNow } from 'date-fns'
import { id as localeID } from 'date-fns/locale'
import { useQueryClient } from '@tanstack/react-query'

interface Notification {
  id: string
  title: string
  description: string
  type: 'incoming' | 'stamped' | 'completed' | 'rejected'
  time: Date
  isRead: boolean
}

export const Header = ({ title, subtitle, onNewAgenda }: { title: string; subtitle?: string; onNewAgenda?: () => void }) => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const unreadCount = notifications.filter(n => !n.isRead).length
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const queryClient = useQueryClient()

  // Helper untuk menambah notifikasi
  const addNotif = useCallback((n: Notification) => {
    setNotifications(prev => {
      // Cegah duplikasi notifikasi dengan ID yang sama
      if (prev.find(item => item.id === n.id)) return prev;
      
      // Mainkan suara notif.wav
      if (audioRef.current) {
        audioRef.current.currentTime = 0; // Reset ke awal jika suara sedang main
        audioRef.current.play().catch((err) => console.log("Audio play blocked by browser:", err));
      }
      
      return [n, ...prev].slice(0, 50);
    });
  }, []);

  // 1. Inisialisasi Audio Lokal & LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('surat_notifs')
    if (saved) {
      try {
        const parsed = JSON.parse(saved).map((n: any) => ({ ...n, time: new Date(n.time) }))
        setNotifications(parsed)
      } catch (e) { console.error("Load fail", e) }
    }

    // Menggunakan file lokal notif.wav di folder public/sounds/
    const audio = new Audio('/sounds/notif.WAV');
    audio.preload = 'auto';
    audio.volume = 0.6; // Sesuaikan volume (0.0 - 1.0)
    audioRef.current = audio;
  }, [])

  // 2. Auto-save ke LocalStorage
  useEffect(() => {
    localStorage.setItem('surat_notifs', JSON.stringify(notifications))
  }, [notifications])

// 3. REALTIME LOGIC (FIXED FOR STEP 1)
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

            if (isNew || isStepUpdate) {
              // KHUSUS INSERT: Tunggu 1 detik agar data di surat_signatures selesai di-insert oleh sistem
              if (isNew) {
                await new Promise(resolve => setTimeout(resolve, 1200));
              }

              const { data: myTurn, error: queryError } = await supabase
                .from('surat_signatures')
                .select('id, role_name')
                .eq('surat_id', newData.id)
                .eq('user_id', currentUser.id)
                .eq('step_order', Number(newData.current_step))
                .maybeSingle();

              if (queryError) console.error("Query Error:", queryError);

              if (myTurn) {
                addNotif({
                  id: `in-${newData.id}-${newData.current_step}`,
                  title: 'Permintaan Stamp Baru',
                  description: `Surat "${newData.judul_surat}" menunggu verifikasi Anda sebagai ${myTurn.role_name}.`,
                  type: 'incoming',
                  time: new Date(),
                  isRead: false
                });
                queryClient.invalidateQueries({ queryKey: ['surat-inbox'] });
              }
            }

            // B. LOGIKA UNTUK PEMBUAT (NOTIF PROGRES)
            if (newData.created_by === currentUser.id && payload.eventType === 'UPDATE' && oldData) {
               // ... (Logika status REJECTED, SELESAI, STAMPED tetap sama seperti sebelumnya)
               if (newData.status === 'REJECTED' && oldData.status !== 'REJECTED') {
                addNotif({ id: `rej-${newData.id}-${Date.now()}`, title: 'Dokumen Ditolak', description: `Surat "${newData.judul_surat}" telah ditolak.`, type: 'rejected', time: new Date(), isRead: false });
              } else if (newData.status === 'SELESAI' && oldData.status !== 'SELESAI') {
                addNotif({ id: `done-${newData.id}`, title: 'Dokumen Selesai!', description: `Surat "${newData.judul_surat}" telah disetujui sepenuhnya.`, type: 'completed', time: new Date(), isRead: false });
              } else if (Number(newData.current_step) > Number(oldData.current_step)) {
                addNotif({ id: `step-${newData.id}-${newData.current_step}`, title: 'Update Progres', description: `Surat "${newData.judul_surat}" disetujui pada Step ${oldData.current_step}.`, type: 'stamped', time: new Date(), isRead: false });
              }
              queryClient.invalidateQueries({ queryKey: ['surat-list'] });
            }
          } catch (err) {
            console.error("Notification Processing Error:", err);
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
                    onClick={() => setNotifications(prev => prev.map(item => item.id === n.id ? {...item, isRead: true} : item))}
                    className={cn(
                      "p-4 border-b border-border/40 flex gap-3 cursor-pointer transition-all",
                      !n.isRead ? "bg-primary/[0.03]" : "opacity-60"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg h-fit",
                      n.type === 'incoming' ? "bg-blue-500/10 text-blue-600" : 
                      n.type === 'rejected' ? "bg-red-500/10 text-red-600" :
                      n.type === 'stamped' ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"
                    )}>
                      {n.type === 'incoming' && <Inbox className="w-4 h-4" />}
                      {n.type === 'rejected' && <AlertCircle className="w-4 h-4" />}
                      {n.type === 'stamped' && <Clock className="w-4 h-4" />}
                      {n.type === 'completed' && <FileCheck className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black leading-tight mb-1 uppercase tracking-tighter">{n.title}</p>
                      <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{n.description}</p>
                      <p className="text-[8px] text-muted-foreground/50 mt-2 font-bold uppercase">
                        {formatDistanceToNow(n.time, { addSuffix: true, locale: localeID })}
                      </p>
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