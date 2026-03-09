import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Users,
  Activity,
  Settings,
  ChevronLeft,
  Building2,
  LogOut,
  ShieldCheck,
  Loader2,
  FileSignature,
  Inbox,
  SearchCheck,
  ChevronDown,
  Mail,
  Database,
  Building,
  Tag,
  MapPin,
  GitMerge,
  Monitor,
  Briefcase,
  MessageSquare,
  Wallet,
  FileText,
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
  const [financeBadgeCount, setFinanceBadgeCount] = useState(0)
  const prevChatCountRef = useRef(0)
  const prevFinanceCountRef = useRef(0)

  useEffect(() => {
    if (collapsed) return;
    const path = location.pathname;
    if (path.startsWith('/surat') || path.startsWith('/pic')) setIsSuratOpen(true);
    if (path.startsWith('/finance')) setIsFinanceOpen(true);
    const masterDataPaths = [
      '/admin/users', '/admin/departments', '/admin/entities', 
      '/admin/forms', '/admin/letter-types', '/admin/offices', 
      '/admin/workflow-details', '/admin/master-projects', '/admin/pic-management'
    ];
    if (masterDataPaths.some(p => path.startsWith(p))) setIsMasterOpen(true);
  }, [location.pathname, collapsed]);

  useEffect(() => {
    const initSidebar = async () => {
      const data = await getCurrentUser()
      if (data) {
        setUser(data)
        // Cek apakah user adalah PIC di master_dept_pics
        const { data: deptPicData } = await supabase
          .from('master_dept_pics')
          .select('id')
          .eq('user_id', data.id)
          .limit(1);
        if (deptPicData && deptPicData.length > 0) setIsUserPIC(true);

        // Cek apakah user adalah finance
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.id)
          .single();
        if (profileData?.role === 'finance') setIsUserFinance(true);
      }
    }
    initSidebar()
  }, [])

useEffect(() => {
    if (!user?.id) return;

const fetchInboxCount = async () => {
  // Tambahkan .single() jika query-mu pasti mengembalikan 1, 
  // tapi karena ini list signatures, kita perbaiki cara akses datanya:
  const { data, error } = await supabase
    .from('surat_signatures')
    .select(`
      id,
      step_order,
      surat_registrasi!inner (
        current_step,
        status
      )
    `)
    .eq('user_id', user.id)
    .eq('is_signed', false)
    .eq('surat_registrasi.status', 'PROSES');

  if (!error && data) {
    // Perbaikan: Tambahkan pengecekan tipe atau casting agar TS tidak error
    const actualPending = data.filter((sig: any) => {
      // Supabase terkadang mengembalikan join sebagai objek atau array isi 1
      const registrasi = Array.isArray(sig.surat_registrasi) 
        ? sig.surat_registrasi[0] 
        : sig.surat_registrasi;

      return registrasi && sig.step_order === registrasi.current_step;
    });

    setInboxCount(actualPending.length);
  }
};

    fetchInboxCount();

    // Realtime subscription tetap sama, pastikan filter kolom sesuai
    const channel = supabase
      .channel('sidebar-realtime')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'surat_signatures', 
        filter: `user_id=eq.${user.id}` 
      }, () => fetchInboxCount())
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'surat_registrasi' 
      }, () => fetchInboxCount())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // ── Badge: chat aktif untuk PIC ────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id || !isUserPIC) return;

    const playChime = () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
      } catch {}
    };

    const fetchChatBadge = async () => {
      const { data: deptPics } = await supabase
        .from('master_dept_pics').select('dept_id').eq('user_id', user.id);
      if (!deptPics?.length) return;
      const deptIds = deptPics.map((d: any) => d.dept_id);
      const { data: forms } = await supabase
        .from('master_forms').select('id').in('department_id', deptIds);
      if (!forms?.length) return;
      const formIds = forms.map((f: any) => f.id);
      const { data: penggunaans } = await supabase
        .from('master_penggunaan_detail').select('id').in('form_id', formIds);
      if (!penggunaans?.length) return;
      const penggunaanIds = penggunaans.map((p: any) => p.id);

      // Ambil surat_id yang relevan untuk PIC ini
      const { data: surats } = await supabase
        .from('surat_registrasi')
        .select('id')
        .in('penggunaan_id', penggunaanIds)
        .eq('status', 'DONE');
      if (!surats?.length) { setChatBadgeCount(0); prevChatCountRef.current = 0; return; }
      const suratIds = surats.map((s: any) => s.id);

      // Hitung pesan dari creator yang belum dibaca PIC
      const { count } = await supabase
        .from('surat_chats')
        .select('id', { count: 'exact', head: true })
        .in('surat_id', suratIds)
        .eq('sender_role', 'creator')
        .eq('is_read', false)
        .eq('is_system', false);

      const n = count ?? 0;
      if (n > prevChatCountRef.current && prevChatCountRef.current >= 0) playChime();
      prevChatCountRef.current = n;
      setChatBadgeCount(n);
    };

    fetchChatBadge();
    const ch = supabase.channel('sidebar-chat-badge')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'surat_registrasi' }, fetchChatBadge)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'surat_chats' }, fetchChatBadge)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, isUserPIC]);

  // ── Badge: antrean keuangan ────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id || !isUserFinance) return;

    const playFinanceChime = () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.35);
      } catch {}
    };

    const fetchFinanceBadge = async () => {
      const { count } = await supabase
        .from('surat_registrasi')
        .select('id', { count: 'exact', head: true })
        .eq('pic_review_status', 'KEUANGAN');
      const n = count ?? 0;
      if (n > prevFinanceCountRef.current && prevFinanceCountRef.current > 0) playFinanceChime();
      prevFinanceCountRef.current = n;
      setFinanceBadgeCount(n);
    };

    fetchFinanceBadge();
    const ch = supabase.channel('sidebar-finance-badge')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'surat_registrasi' }, fetchFinanceBadge)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, isUserFinance]);

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
    <NavLink 
      to={path} 
      end={path === '/dashboard' || path.includes('registrasi')}
      className="group block text-decoration-none"
    >
      {({ isActive }) => (
        <motion.div
          className={cn(
            "relative w-full flex items-center gap-3 py-2 rounded-lg transition-all",
            isSubItem ? "pl-7 pr-4" : "px-3",
            isActive 
              ? "bg-primary/10 text-primary shadow-sm" 
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          whileHover={{ x: 4 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="relative shrink-0">
            <Icon className={cn(isSubItem ? "w-4 h-4" : "w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
            
            {/* Badge Indicator saat Collapsed */}
            {collapsed && label === 'Persetujuan' && inboxCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3 z-10">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-sidebar"></span>
              </span>
            )}
          </div>

          {!collapsed && (
            <div className="flex items-center justify-between w-full overflow-hidden">
              <span className={cn("font-medium truncate", isSubItem ? "text-[11px]" : "text-sm")}>{label}</span>
              {label === 'Persetujuan' && inboxCount > 0 && (
                <span className="ml-2 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm shrink-0">
                  {inboxCount > 99 ? '99+' : inboxCount}
                </span>
              )}
              {(label === 'Diskusi PIC' || label === 'Antrean Review PIC') && chatBadgeCount > 0 && (
                <span className="ml-2 bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm shrink-0 animate-pulse">
                  {chatBadgeCount > 99 ? '99+' : chatBadgeCount}
                </span>
              )}
              {label === 'Antrean Review' && financeBadgeCount > 0 && (
                <span className="ml-2 bg-blue-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm shrink-0 animate-pulse">
                  {financeBadgeCount > 99 ? '99+' : financeBadgeCount}
                </span>
              )}
            </div>
          )}
        </motion.div>
      )}
    </NavLink>
  )

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="sticky top-0 h-screen bg-sidebar border-r border-sidebar-border z-50 flex flex-col shrink-0 overflow-visible"
    >
      {/* HEADER */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-glow">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="truncate">
              <h1 className="font-black text-foreground leading-none text-xs uppercase tracking-tight">SIGAP Digital</h1>
              <p className="text-[8px] text-primary font-bold mt-1 uppercase tracking-widest">Enterprise System</p>
            </motion.div>
          )}
        </div>
        <button onClick={onToggle} className="w-7 h-7 rounded-md bg-accent/50 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors">
          <ChevronLeft className={cn("w-4 h-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 py-4 px-3 space-y-6 overflow-y-auto custom-scrollbar overflow-x-hidden">
        <div className="space-y-1">
          {renderNavLink('/dashboard', 'Dashboard', LayoutDashboard)}
          {renderNavLink('/calendar', 'Calendar', Calendar)}
          {renderNavLink('/agenda', 'Agendas', ClipboardList)}
        </div>

        {/* E-Surat Section */}
        <div className="space-y-1">
          {!collapsed && <p className="px-3 text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-2">Korespondensi</p>}
          <div className="space-y-1">
            <button
              onClick={() => !collapsed && setIsSuratOpen(!isSuratOpen)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors group relative",
                location.pathname.includes('/surat') || location.pathname.includes('/pic') ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-accent"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                   <Mail className="w-5 h-5" />
                   {/* Badge pada icon induk saat collapsed agar user tahu ada inbox */}
                   {collapsed && inboxCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                   )}
                </div>
                {!collapsed && <span className="text-sm font-medium">Layanan Surat</span>}
              </div>
              {!collapsed && (
                <div className="flex items-center gap-2">
                  {inboxCount > 0 && !isSuratOpen && (
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                  )}
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", isSuratOpen && "rotate-180")} />
                </div>
              )}
            </button>
            <AnimatePresence>
              {(isSuratOpen && !collapsed) && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} 
                  animate={{ height: 'auto', opacity: 1 }} 
                  exit={{ height: 0, opacity: 0 }} 
                  className="overflow-hidden space-y-0.5"
                >
                  {renderNavLink('/surat/registrasi', 'Buat Baru', FileSignature, true)}
                  {renderNavLink('/surat/inbox', 'Persetujuan', Inbox, true)}
                  {renderNavLink('/surat/monitoring', 'Status Pengajuan', SearchCheck, true)}
                  {renderNavLink('/surat/chat', 'Diskusi PIC', MessageSquare, true)}
                  {(isUserPIC || user?.role === 'admin') && renderNavLink('/pic/monitoring', 'Antrean Review PIC', Monitor, true)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Finance Section */}
        {(isUserFinance || user?.role === 'admin') && (
          <div className="space-y-1">
            {!collapsed && <p className="px-3 text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-2">Keuangan</p>}
            <div className="space-y-1">
              <button
                onClick={() => !collapsed && setIsFinanceOpen(!isFinanceOpen)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors group",
                  location.pathname.includes('/finance') ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-accent"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Wallet className="w-5 h-5" />
                    {collapsed && financeBadgeCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                    )}
                  </div>
                  {!collapsed && <span className="text-sm font-medium">Tim Keuangan</span>}
                </div>
                {!collapsed && (
                  <div className="flex items-center gap-2">
                    {financeBadgeCount > 0 && !isFinanceOpen && (
                      <span className="bg-blue-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse">
                        {financeBadgeCount > 99 ? '99+' : financeBadgeCount}
                      </span>
                    )}
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", isFinanceOpen && "rotate-180")} />
                  </div>
                )}
              </button>
              <AnimatePresence>
                {(isFinanceOpen && !collapsed) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-0.5">
                    {renderNavLink('/finance/review', 'Antrean Review', FileText, true)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Admin Section */}
        {user?.role === 'admin' && (
          <div className="space-y-1">
            {!collapsed && <p className="px-3 text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-2">Administration</p>}
            <div className="space-y-1">
              <button
                onClick={() => !collapsed && setIsMasterOpen(!isMasterOpen)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors group",
                  isMasterOpen ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-accent"
                )}
              >
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5" />
                  {!collapsed && <span className="text-sm font-medium">Master Data</span>}
                </div>
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

        <div className="pt-2">
          {renderNavLink('/settings', 'Settings', Settings)}
        </div>
      </nav>

      {/* FOOTER */}
      <div className="p-3 bg-sidebar-accent/10 border-t border-sidebar-border mt-auto shrink-0">
        {!collapsed && user && (
          <div className="mb-3 p-2 rounded-xl bg-background/50 border border-border/50 flex items-center gap-3">
            <img 
              src={user.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'U')}&background=0D9488&color=fff`}
              className="w-8 h-8 rounded-lg object-cover shadow-sm ring-1 ring-border"
              alt="Profile"
            />
            <div className="flex-1 overflow-hidden">
              <p className="text-[11px] font-black truncate text-foreground uppercase tracking-tighter">{user.fullName}</p>
              <div className="flex items-center gap-1">
                <ShieldCheck className="w-2.5 h-2.5 text-primary" />
                <p className="text-[8px] text-muted-foreground truncate uppercase font-bold">{user.jobTitle || 'Member'}</p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors group",
            collapsed && "justify-center"
          )}
        >
          {isLoggingOut ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
          {!collapsed && <span className="text-xs font-bold uppercase tracking-widest">Sign Out</span>}
        </button>
      </div>
    </motion.aside>
  )
}