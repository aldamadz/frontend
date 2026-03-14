import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, ClipboardList, Users, Activity, Settings,
  ChevronLeft, Building2, LogOut, ShieldCheck, Loader2, FileSignature,
  Inbox, SearchCheck, ChevronDown, Mail, Database, Building, Tag, MapPin,
  GitMerge, Monitor, Briefcase, MessageSquare, Wallet, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { supabase } from "@/lib/supabase"
import { getCurrentUser } from '@/services/user-ui.service'
import { useQueryClient } from '@tanstack/react-query'
import type { User } from '@/types/agenda'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  
  const [user, setUser] = useState<User | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [inboxCount, setInboxCount] = useState<number>(0)
  const [isUserPIC, setIsUserPIC] = useState(false)
  const [isSuratOpen, setIsSuratOpen] = useState(false)
  const [isFinanceOpen, setIsFinanceOpen] = useState(false)
  const [isUserFinance, setIsUserFinance] = useState(false)
  const [isMasterOpen, setIsMasterOpen] = useState(false)

  const [chatBadgeCount, setChatBadgeCount] = useState(0)
  const [creatorChatBadge, setCreatorChatBadge] = useState(0)
  const [monitoringBadge, setMonitoringBadge] = useState(0)
  const [financeBadgeCount, setFinanceBadgeCount] = useState(0)
  const [picQueueCount, setPicQueueCount] = useState(0)

  const prevChatCountRef    = useRef(0)
  const prevCreatorBadgeRef = useRef(-1)
  const prevFinanceCountRef = useRef(0)
  const prevPicQueueRef     = useRef(-1)

  const playNotif = () => {
    try {
      const audio = new Audio('/sounds/notif.WAV')
      audio.volume = 0.6
      audio.play().catch(() => {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          osc.type = 'sine'
          osc.frequency.setValueAtTime(1046, ctx.currentTime)
          osc.frequency.setValueAtTime(1318, ctx.currentTime + 0.12)
          osc.frequency.setValueAtTime(1567, ctx.currentTime + 0.24)
          gain.gain.setValueAtTime(0.3, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
          osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5)
        } catch {}
      })
    } catch {}
  }

  // Helper: ambil penggunaanIds milik PIC user
  const getPicPenggunaanIds = async (userId: string): Promise<string[] | null> => {
    const { data: deptPics } = await supabase
      .from('master_dept_pics').select('dept_id').eq('user_id', userId)
    if (!deptPics?.length) return null
    const deptIds = deptPics.map((d: any) => d.dept_id)

    const { data: forms } = await supabase
      .from('master_forms').select('id').in('department_id', deptIds)
    if (!forms?.length) return null
    const formIds = forms.map((f: any) => f.id)

    const { data: penggunaans } = await supabase
      .from('master_penggunaan_detail').select('id').in('form_id', formIds)
    if (!penggunaans?.length) return null
    return penggunaans.map((p: any) => p.id)
  }

  // Reset badge monitoring saat user buka /surat/monitoring
  useEffect(() => {
    if (location.pathname.startsWith('/surat/monitoring') && user?.id) {
      const t = setTimeout(async () => {
        // Update creator_seen_at ke now() untuk semua surat DONE milik user
        await supabase
          .from('surat_registrasi')
          .update({ creator_seen_at: new Date().toISOString() })
          .eq('created_by', user.id)
          .eq('status', 'DONE')
        setMonitoringBadge(0)
      }, 800)
      return () => clearTimeout(t)
    }
  }, [location.pathname, user?.id])

  // Reset picQueueCount saat buka /pic/monitoring
  useEffect(() => {
    if (location.pathname.startsWith('/pic/monitoring') && user?.id && isUserPIC) {
      const t = setTimeout(async () => {
        const penggunaanIds = await getPicPenggunaanIds(user.id)
        if (!penggunaanIds) { setPicQueueCount(0); return }
        // Hitung semua yang BELUM selesai: PENDING, SPK, KEUANGAN
        const { count } = await supabase
          .from('surat_registrasi')
          .select('id', { count: 'exact', head: true })
          .in('penggunaan_id', penggunaanIds)
          .or('pic_review_status.is.null,pic_review_status.eq.PENDING,pic_review_status.eq.KEUANGAN')
          .eq('status', 'DONE')
        setPicQueueCount(count ?? 0)
      }, 1500)
      return () => clearTimeout(t)
    }
  }, [location.pathname, user?.id, isUserPIC])

  useEffect(() => {
    if (collapsed) return
    const path = location.pathname
    if (path.startsWith('/surat') || path.startsWith('/pic')) setIsSuratOpen(true)
    if (path.startsWith('/finance')) setIsFinanceOpen(true)
    const masterDataPaths = ['/admin/users', '/admin/departments', '/admin/entities', '/admin/forms', '/admin/letter-types', '/admin/offices', '/admin/workflow-details', '/admin/master-projects', '/admin/pic-management']
    if (masterDataPaths.some(p => path.startsWith(p))) setIsMasterOpen(true)
  }, [location.pathname, collapsed])

  useEffect(() => {
    const initSidebar = async () => {
      const data = await getCurrentUser()
      if (data) {
        setUser(data)
        const { data: deptPicData } = await supabase.from('master_dept_pics').select('id').eq('user_id', data.id).limit(1)
        if (deptPicData && deptPicData.length > 0) setIsUserPIC(true)
        const { data: profileData } = await supabase.from('profiles').select('role').eq('id', data.id).single()
        if (profileData?.role === 'finance') setIsUserFinance(true)

        // Cek apakah user adalah PIC di departemen Keuangan & Akuntansi
        // Tidak bergantung pada kolom role, tapi berdasarkan master_dept_pics
        const { data: keuDept } = await supabase
          .from('master_departments')
          .select('id')
          .ilike('name', '%keuangan%')
          .limit(5)
        if (keuDept?.length) {
          const keuDeptIds = keuDept.map((d: any) => d.id)
          const { data: isKeuPIC } = await supabase
            .from('master_dept_pics')
            .select('id')
            .eq('user_id', data.id)
            .in('dept_id', keuDeptIds)
            .limit(1)
          if (isKeuPIC && isKeuPIC.length > 0) setIsUserFinance(true)
        }
      }
    }
    initSidebar()
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const fetchInboxCount = async () => {
      const { data: suratProses } = await supabase.from('surat_registrasi').select('id, current_step').eq('status', 'PROSES')
      if (!suratProses?.length) { setInboxCount(0); return }
      const suratIds = suratProses.map((s: any) => s.id)
      const currentStepMap: Record<string, number> = {}
      suratProses.forEach((s: any) => { currentStepMap[s.id] = s.current_step })
      const { data, error } = await supabase.from('surat_signatures').select('id, step_order, surat_id').eq('user_id', user.id).eq('is_signed', false).in('surat_id', suratIds)
      if (!error && data) {
        const actualPending = data.filter((sig: any) => sig.step_order === currentStepMap[sig.surat_id])
        setInboxCount(actualPending.length)
      }
    }
    fetchInboxCount()
    const channel = supabase.channel('sidebar-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'surat_signatures', filter: `user_id=eq.${user.id}` }, () => fetchInboxCount())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'surat_registrasi' }, () => fetchInboxCount())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || !isUserPIC) return

    const fetchChatBadge = async () => {
      const penggunaanIds = await getPicPenggunaanIds(user.id)
      if (!penggunaanIds) { setChatBadgeCount(0); return }

      const { data: surats } = await supabase.from('surat_registrasi').select('id').in('penggunaan_id', penggunaanIds).eq('status', 'DONE')
      if (!surats?.length) { setChatBadgeCount(0); prevChatCountRef.current = 0; return }
      const suratIds = surats.map((s: any) => s.id)

      const { count } = await supabase.from('surat_chats').select('id', { count: 'exact', head: true }).in('surat_id', suratIds).eq('sender_role', 'creator').eq('is_read', false).eq('is_system', false)
      const n = count ?? 0
      if (n > prevChatCountRef.current && prevChatCountRef.current >= 0) playNotif()
      prevChatCountRef.current = n
      setChatBadgeCount(n)

      // Hitung picQueueCount — semua status belum selesai: PENDING, SPK, KEUANGAN
      const { count: qCount } = await supabase
        .from('surat_registrasi')
        .select('id', { count: 'exact', head: true })
        .in('penggunaan_id', penggunaanIds)
        .or('pic_review_status.is.null,pic_review_status.eq.PENDING,pic_review_status.eq.KEUANGAN')
        .eq('status', 'DONE')

      const newQ = qCount ?? 0
      if (prevPicQueueRef.current >= 0 && newQ > prevPicQueueRef.current) {
        playNotif()
        toast.info('Pengajuan baru masuk ke antrian PIC!', { duration: 5000, description: `${newQ} pengajuan menunggu review` })
      }
      prevPicQueueRef.current = newQ
      setPicQueueCount(newQ)
    }

    fetchChatBadge()
    const ch = supabase.channel('sidebar-chat-badge')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'surat_registrasi' }, fetchChatBadge)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'surat_chats' }, fetchChatBadge)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'surat_chats' }, fetchChatBadge)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id, isUserPIC])

  useEffect(() => {
    if (!user?.id) return
    const fetchCreatorBadge = async () => {
      const { data: surats } = await supabase.from('surat_registrasi').select('id').eq('created_by', user.id).eq('status', 'DONE')
      if (!surats?.length) { setCreatorChatBadge(0); prevCreatorBadgeRef.current = 0; return }
      const suratIds = surats.map((s: any) => s.id)
      const { count } = await supabase.from('surat_chats').select('id', { count: 'exact', head: true }).in('surat_id', suratIds).eq('sender_role', 'pic').eq('is_read', false).eq('is_system', false)
      const n = count ?? 0
      if (prevCreatorBadgeRef.current >= 0 && n > prevCreatorBadgeRef.current) playNotif()
      prevCreatorBadgeRef.current = n
      setCreatorChatBadge(n)
    }
    const fetchMonitoringBadge = async () => {
      // Badge muncul saat ada surat yang DONE tapi creator belum lihat
      // (creator_seen_at null ATAU updated_at > creator_seen_at)
      const { data: surats } = await supabase
        .from('surat_registrasi')
        .select('id, updated_at, creator_seen_at')
        .eq('created_by', user.id)
        .eq('status', 'DONE')
      const unseen = (surats ?? []).filter((s: any) =>
        !s.creator_seen_at || new Date(s.updated_at) > new Date(s.creator_seen_at)
      )
      setMonitoringBadge(unseen.length)
    }
    fetchMonitoringBadge(); fetchCreatorBadge()
    const ch = supabase.channel(`sidebar-creator-chat-badge:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'surat_chats' }, fetchCreatorBadge)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'surat_chats' }, fetchCreatorBadge)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'surat_registrasi' }, fetchMonitoringBadge)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || !isUserFinance) return
    const fetchFinanceBadge = async () => {
      const { count } = await supabase.from('finance_reviews').select('id', { count: 'exact', head: true }).in('status', ['PENDING', 'IN_REVIEW'])
      const n = count ?? 0
      if (n > prevFinanceCountRef.current && prevFinanceCountRef.current > 0) playNotif()
      prevFinanceCountRef.current = n
      setFinanceBadgeCount(n)
    }
    fetchFinanceBadge()
    const ch = supabase.channel('sidebar-finance-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_reviews' }, fetchFinanceBadge)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'surat_registrasi' }, fetchFinanceBadge)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id, isUserFinance])

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    const toastId = toast.loading("Sedang keluar...")
    try {
      await supabase.removeAllChannels()
      await supabase.auth.signOut()
      localStorage.removeItem("isLoggedIn")
      localStorage.removeItem("sb-remember")
      queryClient.clear()
      toast.success("Berhasil keluar", { id: toastId })
      window.location.replace("/")
    } catch (error: any) {
      toast.error("Logout failed: " + error.message, { id: toastId })
      setIsLoggingOut(false)
    }
  }

  const renderNavLink = (path: string, label: string, Icon: any, isSubItem = false) => (
    <NavLink to={path} end={path === '/dashboard' || path.includes('registrasi')} className="group block text-decoration-none">
      {({ isActive }) => (
        <motion.div
          className={cn("relative w-full flex items-center gap-3 py-2 rounded-lg transition-all", isSubItem ? "pl-7 pr-4" : "px-3", isActive ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
          whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}
        >
          <div className="relative shrink-0">
            <Icon className={cn(isSubItem ? "w-4 h-4" : "w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
            {collapsed && label === 'Persetujuan' && inboxCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3 z-10"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-sidebar"></span></span>
            )}
            {collapsed && label === 'Antrean Review PIC' && picQueueCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3 z-10"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border-2 border-sidebar"></span></span>
            )}
            {collapsed && label === 'Diskusi PIC' && creatorChatBadge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3 z-10"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-primary border-2 border-sidebar"></span></span>
            )}
          </div>
          {!collapsed && (
            <div className="flex items-center justify-between w-full overflow-hidden">
              <span className={cn("font-medium truncate", isSubItem ? "text-[11px]" : "text-sm")}>{label}</span>
              {label === 'Persetujuan' && inboxCount > 0 && <span className="ml-2 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm shrink-0">{inboxCount > 99 ? '99+' : inboxCount}</span>}
              {label === 'Status Pengajuan' && monitoringBadge > 0 && <span className="ml-2 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm shrink-0 animate-pulse">{monitoringBadge > 99 ? '99+' : monitoringBadge}</span>}
              {label === 'Diskusi PIC' && creatorChatBadge > 0 && <span className="ml-2 bg-primary text-primary-foreground text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm shrink-0 animate-pulse">{creatorChatBadge > 99 ? '99+' : creatorChatBadge}</span>}
              {label === 'Antrean Review PIC' && picQueueCount > 0 && <span className="ml-2 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm shrink-0 animate-pulse">{picQueueCount > 99 ? '99+' : picQueueCount}</span>}
              {label === 'Antrean Review' && financeBadgeCount > 0 && <span className="ml-2 bg-blue-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm shrink-0 animate-pulse">{financeBadgeCount > 99 ? '99+' : financeBadgeCount}</span>}
            </div>
          )}
        </motion.div>
      )}
    </NavLink>
  )

  return (
    <motion.aside initial={false} animate={{ width: collapsed ? 72 : 260 }} transition={{ duration: 0.2, ease: "easeInOut" }} className="sticky top-0 h-screen bg-sidebar border-r border-sidebar-border z-50 flex flex-col shrink-0 overflow-visible">
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-glow"><Building2 className="w-5 h-5 text-primary-foreground" /></div>
          {!collapsed && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="truncate"><h1 className="font-black text-foreground leading-none text-xs uppercase tracking-tight">SIGAP Digital</h1><p className="text-[8px] text-primary font-bold mt-1 uppercase tracking-widest">Enterprise System</p></motion.div>)}
        </div>
        <button onClick={onToggle} className="w-7 h-7 rounded-md bg-accent/50 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"><ChevronLeft className={cn("w-4 h-4 transition-transform", collapsed && "rotate-180")} /></button>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-6 overflow-y-auto custom-scrollbar overflow-x-hidden">
        <div className="space-y-1">
          {renderNavLink('/dashboard', 'Dashboard', LayoutDashboard)}
          {renderNavLink('/calendar', 'Calendar', Calendar)}
          {renderNavLink('/agenda', 'Agendas', ClipboardList)}
        </div>

        <div className="space-y-1">
          {!collapsed && <p className="px-3 text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-2">Korespondensi</p>}
          <div className="space-y-1">
            <button onClick={() => !collapsed && setIsSuratOpen(!isSuratOpen)} className={cn("w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors group relative", location.pathname.includes('/surat') || location.pathname.includes('/pic') ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-accent")}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Mail className="w-5 h-5" />
                  {collapsed && (inboxCount > 0 || chatBadgeCount > 0 || creatorChatBadge > 0 || picQueueCount > 0) && (<span className="absolute -top-1 -right-1 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>)}
                </div>
                {!collapsed && <span className="text-sm font-medium">Layanan Surat</span>}
              </div>
              {!collapsed && (
                <div className="flex items-center gap-2">
                  {creatorChatBadge > 0 && !isSuratOpen && <span className="bg-primary text-primary-foreground text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse">{creatorChatBadge > 99 ? '99+' : creatorChatBadge}</span>}
                  {picQueueCount > 0 && !isSuratOpen && <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse">{picQueueCount > 99 ? '99+' : picQueueCount}</span>}
                  {inboxCount > 0 && !isSuratOpen && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", isSuratOpen && "rotate-180")} />
                </div>
              )}
            </button>
            <AnimatePresence>
              {(isSuratOpen && !collapsed) && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-0.5">
                  {renderNavLink('/surat/registrasi', 'Buat Baru', FileSignature, true)}
                  {renderNavLink('/surat/inbox', 'Persetujuan', Inbox, true)}
                  {renderNavLink('/surat/monitoring', 'Status Pengajuan', SearchCheck, true)}
                  {renderNavLink('/surat/chat', 'Diskusi PIC', MessageSquare, true)}
                  {(isUserPIC && !isUserFinance || user?.role === 'admin') && renderNavLink('/pic/monitoring', 'Antrean Review PIC', Monitor, true)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {user?.role === 'admin' && (
          <div className="space-y-1">
            {!collapsed && <p className="px-3 text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-2">Administration</p>}
            <div className="space-y-1">
              <button onClick={() => !collapsed && setIsMasterOpen(!isMasterOpen)} className={cn("w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors group", isMasterOpen ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-accent")}>
                <div className="flex items-center gap-3"><Database className="w-5 h-5" />{!collapsed && <span className="text-sm font-medium">Master Data</span>}</div>
                {!collapsed && <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", isMasterOpen && "rotate-180")} />}
              </button>
              <AnimatePresence>
                {(isMasterOpen && !collapsed) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-0.5">
                    {renderNavLink('/admin/users', 'User Organization', Users, true)}
                    {renderNavLink('/admin/departments', 'Master Departemen', Building2, true)}
                    {renderNavLink('/admin/entities', 'Master Entitas', Building, true)}
                    {renderNavLink('/admin/forms', 'Master Form', FileSignature, true)}
                    {renderNavLink('/admin/letter-types', 'Master Jenis Surat', Tag, true)}
                    {renderNavLink('/admin/offices', 'Master Kantor Cabang', MapPin, true)}
                    {renderNavLink('/admin/master-projects', 'Master Proyek', Briefcase, true)}
                    {renderNavLink('/admin/workflow-details', 'Matriks Tanda Tangan', GitMerge, true)}
                    {renderNavLink('/admin/pic-management', 'Manajemen PIC', ShieldCheck, true)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {renderNavLink('/admin/monitoring', 'All Status Monitoring', Monitor)}
            {renderNavLink('/activity-logs', 'Activity Logs', Activity)}
          </div>
        )}

        <div className="pt-2">{renderNavLink('/settings', 'Settings', Settings)}</div>
      </nav>

      <div className="p-3 bg-sidebar-accent/10 border-t border-sidebar-border mt-auto shrink-0">
        {!collapsed && user && (
          <div className="mb-3 p-2 rounded-xl bg-background/50 border border-border/50 flex items-center gap-3">
            <img src={user.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'U')}&background=0D9488&color=fff`} className="w-8 h-8 rounded-lg object-cover shadow-sm ring-1 ring-border" alt="Profile" />
            <div className="flex-1 overflow-hidden">
              <p className="text-[11px] font-black truncate text-foreground uppercase tracking-tighter">{user.fullName}</p>
              <div className="flex items-center gap-1"><ShieldCheck className="w-2.5 h-2.5 text-primary" /><p className="text-[8px] text-muted-foreground truncate uppercase font-bold">{user.jobTitle || 'Member'}</p></div>
            </div>
          </div>
        )}
        <button onClick={handleLogout} disabled={isLoggingOut} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors group", collapsed && "justify-center")}>
          {isLoggingOut ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
          {!collapsed && <span className="text-xs font-bold uppercase tracking-widest">Sign Out</span>}
        </button>
      </div>
    </motion.aside>
  )
}