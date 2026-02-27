import { useState, useEffect } from 'react'
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
  Briefcase
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
  const [isPICOpen, setIsPICOpen] = useState(false)
  const [isMasterOpen, setIsMasterOpen] = useState(false)

  useEffect(() => {
    if (collapsed) return;
    const path = location.pathname;
    if (path.startsWith('/surat')) setIsSuratOpen(true);
    if (path.startsWith('/pic')) setIsPICOpen(true);
    const masterDataPaths = [
      '/admin/users', '/admin/departments', '/admin/entities', 
      '/admin/forms', '/admin/letter-types', '/admin/offices', 
      '/admin/workflow-details', '/admin/master-projects'
    ];
    if (masterDataPaths.some(p => path.startsWith(p))) setIsMasterOpen(true);
  }, [location.pathname, collapsed]);

  useEffect(() => {
    const initSidebar = async () => {
      const data = await getCurrentUser()
      if (data) {
        setUser(data)
        const { data: picForms } = await supabase
          .from('master_forms')
          .select('id')
          .eq('pic_id', data.id)
          .limit(1);
        if (picForms && picForms.length > 0) setIsUserPIC(true);
      }
    }
    initSidebar()
  }, [])

  useEffect(() => {
    if (!user?.id) return;
    const fetchInboxCount = async () => {
      const { data, error } = await supabase
        .from('surat_signatures')
        .select(`
          id,
          surat_registrasi!inner (
            current_step,
            status
          )
        `)
        .eq('user_id', user.id)
        .eq('is_signed', false)
        .eq('surat_registrasi.status', 'PROSES');

      if (!error && data) setInboxCount(data.length);
    };

    fetchInboxCount();
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
            // Padding kanan ditambah agar badge tidak menempel ke border sidebar
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
            {/* Badge saat Collapsed - dipastikan z-index tinggi */}
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
                "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors group",
                location.pathname.includes('/surat') ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-accent"
              )}
            >
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5" />
                {!collapsed && <span className="text-sm font-medium">Layanan Surat</span>}
              </div>
              {!collapsed && <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", isSuratOpen && "rotate-180")} />}
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* PIC Section */}
        {(isUserPIC || user?.role === 'admin') && (
          <div className="space-y-1">
            {!collapsed && <p className="px-3 text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-2">Unit Control</p>}
            <div className="space-y-1">
              <button
                onClick={() => !collapsed && setIsPICOpen(!isPICOpen)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors group",
                  location.pathname.includes('/pic') ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-accent"
                )}
              >
                <div className="flex items-center gap-3">
                  <Monitor className="w-5 h-5" />
                  {!collapsed && <span className="text-sm font-medium">Layanan PIC</span>}
                </div>
                {!collapsed && <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", isPICOpen && "rotate-180")} />}
              </button>
              <AnimatePresence>
                {(isPICOpen && !collapsed) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-0.5">
                    {renderNavLink('/pic/monitoring', 'Monitoring Unit', SearchCheck, true)}
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
                    {renderNavLink('/admin/workflow-details', 'Workflow Matrix', GitMerge, true)}
                    {renderNavLink('/admin/master-projects', 'Master Proyek', Briefcase, true)}
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