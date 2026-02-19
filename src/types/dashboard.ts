/* ======================================================
   DASHBOARD TYPES
   - Khusus untuk kebutuhan UI / analytics
   - Tidak mirror Prisma langsung
====================================================== */

/* ======================
   SUMMARY STATS (KPI)
====================== */

export interface DashboardStats {
  totalAgendas: number;
  completedAgendas: number;
  pendingAgendas: number;
  activeUsers: number;
}

export interface KPIData {
  label: string
  value: number
  change: number
  trend: 'up' | 'down' | 'neutral'
}

/* ======================
   STATUS CHART
====================== */

export interface StatusChartData {
  name: string
  value: number
  color?: string
}

/* ======================
   DEPARTMENT GROUPING
   (logical, derived from jobTitle)
====================== */

export interface DepartmentActivity {
  name: string
  tasks: number
  completed: number
}

/* ======================
   RECENT ACTIVITY (UI READY)
====================== */

export interface RecentActivityItem {
  id: string
  actorName: string
  avatar?: string // Tambahkan untuk UI profil
  action: string
  entity: string
  entityId: string | number // UUID di Supabase biasanya string
  createdAt: string | Date
}

/* ======================
   OPTIONAL: TEAM / HIERARCHY
====================== */

export interface TeamActivity {
  leaderName: string
  teamSize: number
  tasks: number
  completed: number
}