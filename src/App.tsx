import { useState, useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from "@/lib/supabase";

// IMPORT KOMPONEN SYNC
import { RealtimeSync } from "@/providers/RealtimeSync"; 

// STATIC IMPORT
import LoginPage from "@/pages/auth/LoginPage"; 
import DepartmentManagementPage from "./pages/admin/DepartmentManagementPage";
import EntityManagementPage from "./pages/admin/EntityManagementPage";
import FormManagementPage from "./pages/admin/FormManagementPage";
import LetterTypeManagementPage from "./pages/admin/LetterTypeManagementPage";
import OfficeManagementPage from "./pages/admin/OfficeManagementPage";
import WorkflowDetailManagementPage from "./pages/admin/WorkflowDetailManagementPage";
import MasterProjectManagementPage from "./pages/admin/ProjectManagementPage";

// LAZY IMPORT
const DashboardPage = lazy(() => import("@/pages/dashboard/DashboardPage"));
const AgendaPage = lazy(() => import("@/pages/agenda/AgendaPage"));
const CalendarPage = lazy(() => import("@/pages/calendar/CalendarPage"));
const ActivityLogsPage = lazy(() => import("@/pages/activity-logs/ActivityLogsPage"));
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage"));
const UserManagementPage = lazy(() => import("@/pages/admin/UserManagementPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// KOMPONEN SURAT
const SuratPage = lazy(() => import("@/pages/surat/SuratPage"));
const InboxPage = lazy(() => import("@/pages/surat/InboxPage"));
const MonitoringPage = lazy(() => import("@/pages/surat/MonitoringPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="h-screen w-full flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      <p className="text-sm text-muted-foreground animate-pulse">Menyiapkan Sesi...</p>
    </div>
  </div>
);

const App = () => {
  const [session, setSession] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitializing(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_OUT') {
        queryClient.clear();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (initializing) return <PageLoader />;

  const isAuth = !!session;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {isAuth && <RealtimeSync />}
        
        <Toaster />
        <Sonner position="top-right" closeButton />

        <Suspense fallback={<PageLoader />}>
          {/* Hapus AnimatePresence dari sini, pindahkan ke AppLayout */}
          <Routes location={location}>
            {/* PUBLIC ROUTE */}
            <Route 
              path="/" 
              element={isAuth ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
            />

            {/* PROTECTED ROUTES */}
            <Route 
              element={isAuth ? <AppLayout /> : <Navigate to="/" replace />}
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/agenda" element={<AgendaPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/activity-logs" element={<ActivityLogsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              
              <Route path="/surat/registrasi" element={<SuratPage />} />
              <Route path="/surat/inbox" element={<InboxPage />} />
              <Route path="/surat/monitoring" element={<MonitoringPage />} />
              
              <Route path="/admin/users" element={<UserManagementPage />} />
              <Route path="/admin/departments" element={<DepartmentManagementPage />} />
              <Route path="/admin/entities" element={<EntityManagementPage />} />
              <Route path="/admin/forms" element={<FormManagementPage />} />
              <Route path="/admin/letter-types" element={<LetterTypeManagementPage />} />
              <Route path="/admin/offices" element={<OfficeManagementPage />} />
              <Route path="/admin/workflow-details" element={<WorkflowDetailManagementPage />} />
              <Route path="/admin/master-projects" element={<MasterProjectManagementPage />} />
              

            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;