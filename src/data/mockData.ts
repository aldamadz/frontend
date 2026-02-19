import { addDays, subDays } from 'date-fns'

/* ======================================================
   ENUM (mirror Prisma enums)
====================================================== */

export type OfficeType = 'Pusat' | 'Cabang' | 'KCP'
export type Role = 'admin' | 'user'
export type AgendaStatus =
  | 'Scheduled'
  | 'Ongoing'
  | 'Completed'
  | 'Deleted'
  | 'Overdue'

export type ActivityAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN'

/* ======================================================
   MODELS (Semua ID menggunakan String untuk UUID)
====================================================== */

export type Office = {
  id: string
  name: string
  type: OfficeType
  parentId?: string | null
  deletedAt?: Date | null
}

export type User = {
  id: string
  email: string
  nik: string
  fullName: string
  jobTitle: string
  photoUrl?: string | null
  role: Role
  officeId?: string | null
  parentId?: string | null
  deletedAt?: Date | null
}

export type Agenda = {
  id: string
  title: string
  description?: string | null
  location?: string | null
  startTime: Date
  endTime: Date
  createdBy?: string | null
  status: AgendaStatus
  completedAt?: Date | null
  deletedAt?: Date | null
  isDeleted: boolean
}

export type ActivityLog = {
  id: bigint
  userId?: string | null
  action: ActivityAction
  tableName: string
  recordId: string
  oldValues?: any | null
  newValues?: any | null
  createdAt: Date
}

/* ======================================================
   OFFICE (Hierarchy menggunakan String ID)
====================================================== */

export const offices: Office[] = [
  {
    id: 'off-1',
    name: 'Kantor Pusat',
    type: 'Pusat',
    parentId: null,
    deletedAt: null,
  },
  {
    id: 'off-2',
    name: 'Cabang Jakarta',
    type: 'Cabang', 
    parentId: 'off-1',
    deletedAt: null,
  },
  {
    id: 'off-3', 
    name: 'KCP Jakarta Selatan', 
    type: 'KCP', 
    parentId: 'off-2', 
    deletedAt: null,
  },
  {
    id: 'off-4', 
    name: 'Cabang Bandung', 
    type: 'Cabang', 
    parentId: 'off-1',
    deletedAt: null,
  },
]

/* ======================================================
   USER (Hierarchy menggunakan String ID)
====================================================== */

export const users: User[] = [
  {
    id: 'user-1',
    email: 'direktur@corp.id',
    nik: '10000001',
    fullName: 'Direktur Utama',
    jobTitle: 'Direktur',
    photoUrl: null,
    role: 'admin',
    officeId: 'off-1',
    parentId: null,
    deletedAt: null,
  },
  {
    id: 'user-2',
    email: 'kacab.jakarta@corp.id',
    nik: '20000001',
    fullName: 'Kepala Cabang Jakarta',
    jobTitle: 'Kepala Cabang',
    photoUrl: null,
    role: 'user',
    officeId: 'off-2',
    parentId: 'user-1',
    deletedAt: null,
  },
  {
    id: 'user-3',
    email: 'spv.jakarta@corp.id',
    nik: '30000001',
    fullName: 'Supervisor Jakarta',
    jobTitle: 'Supervisor',
    photoUrl: null,
    role: 'user',
    officeId: 'off-2',
    parentId: 'user-2',
    deletedAt: null,
  },
  {
    id: 'user-4',
    email: 'staff.jakarta@corp.id',
    nik: '40000001',
    fullName: 'Staff Jakarta',
    jobTitle: 'Staff',
    photoUrl: null,
    role: 'user',
    officeId: 'off-2',
    parentId: 'user-3',
    deletedAt: null,
  },
]

/* ======================================================
   CURRENT USER (Login Simulation)
====================================================== */

export const currentUser: User = users[2] // Supervisor Jakarta

/* ======================================================
   AGENDA (isDeleted ditambahkan)
====================================================== */

export const agendas: Agenda[] = [
  {
    id: 'age-1',
    title: 'Rapat Evaluasi Cabang Jakarta',
    description: 'Evaluasi kinerja bulanan cabang Jakarta',
    location: 'Ruang Meeting Lt.2',
    startTime: addDays(new Date(), 1),
    endTime: addDays(new Date(), 1),
    createdBy: 'user-2',
    status: 'Scheduled',
    completedAt: null,
    deletedAt: null,
    isDeleted: false
  },
  {
    id: 'age-2',
    title: 'Review Operasional Harian',
    description: 'Review proses operasional harian',
    location: 'Zoom',
    startTime: subDays(new Date(), 1),
    endTime: subDays(new Date(), 1),
    createdBy: 'user-3',
    status: 'Completed',
    completedAt: new Date(),
    deletedAt: null,
    isDeleted: false
  },
  {
    id: 'age-3',
    title: 'Laporan Kinerja Bandung',
    description: 'Penyusunan laporan kinerja cabang Bandung',
    location: 'Kantor Bandung',
    startTime: addDays(new Date(), 2),
    endTime: addDays(new Date(), 2),
    createdBy: 'user-1',
    status: 'Ongoing',
    completedAt: null,
    deletedAt: null,
    isDeleted: false
  },
]

/* ======================================================
   ACTIVITY LOG (Audit Trail)
====================================================== */

export const activityLogs: ActivityLog[] = [
  {
    id: BigInt(1),
    userId: 'user-2',
    action: 'CREATE',
    tableName: 'agendas',
    recordId: 'age-1',
    oldValues: null,
    newValues: { title: 'Rapat Evaluasi Cabang Jakarta' },
    createdAt: subDays(new Date(), 3),
  },
  {
    id: BigInt(2),
    userId: 'user-3',
    action: 'UPDATE',
    tableName: 'agendas',
    recordId: 'age-2',
    oldValues: { status: 'Scheduled' },
    newValues: { status: 'Completed' },
    createdAt: subDays(new Date(), 1),
  },
  {
    id: BigInt(3),
    userId: 'user-1',
    action: 'LOGIN',
    tableName: 'users',
    recordId: 'user-1',
    oldValues: null,
    newValues: null,
    createdAt: new Date(),
  },
]

/* ======================================================
   HELPER (Updated for String ID)
====================================================== */

export function buildTree<T extends { id: string; parentId?: string | null }>(
  items: T[],
) {
  const map = new Map<string, T & { children: T[] }>()
  const roots: (T & { children: T[] })[] = []

  items.forEach(item => {
    map.set(item.id, { ...item, children: [] })
  })

  map.forEach(item => {
    if (item.parentId) {
      map.get(item.parentId)?.children.push(item)
    } else {
      roots.push(item)
    }
  })

  return roots
}