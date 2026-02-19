import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion' // Tambahkan ini

const TITLE: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Overview of your agenda metrics' },
  '/calendar': { title: 'Calendar', subtitle: 'Drag and drop to reschedule' },
  '/agenda': { title: 'Agendas', subtitle: 'Manage your tasks and meetings' },
  '/hierarchy': { title: 'Organization', subtitle: '7-level hierarchy structure' },
  '/activity-logs': { title: 'Activity Logs', subtitle: 'Audit trail of all actions' },
  '/settings': { title: 'Settings', subtitle: 'Configure your preferences' },
  '/surat/registrasi': { title: 'Registrasi Surat', subtitle: 'Kelola pendaftaran surat masuk & keluar' },
  '/surat/inbox': { title: 'Inbox Approval', subtitle: 'Daftar surat yang memerlukan persetujuan' },
  '/surat/monitoring': { title: 'Monitoring Surat', subtitle: 'Lacak status dan alur distribusi surat' },
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  const { title, subtitle } =
    TITLE[location.pathname] || { title: '', subtitle: '' }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
      />

      <main className="flex flex-1 flex-col min-w-0 relative">
        <Header title={title} subtitle={subtitle} />
        
        {/* Kontainer Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Bungkus Outlet dengan AnimatePresence */}
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname} // Kunci utama: trigger animasi saat path berubah
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}