// frontend/src/pages/agenda/AgendaPage.tsx
import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { AgendaTabs } from '@/components/agenda/AgendaTabs'
import { AgendaModal } from '@/components/agenda/AgendaModal'
import { AgendaDetailModal } from '@/components/agenda/AgendaModalDetail'
import { AgendaParentFilter } from '@/components/agenda/AgendaParentFilter'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// Gabungkan semua import service agar tidak bentrok
import { 
  getAgendas, 
  getUsers, 
  saveAgenda, 
  updateAgendaStatus,
  deleteAgenda,
  getAgendasForParent, 
  isParentUser 
} from '@/services'

import { useAuth } from '@/hooks/use-auth'
import type { Agenda, AgendaStatus } from '@/types/agenda'

export default function AgendaPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth() as any
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedAgenda, setSelectedAgenda] = useState<Agenda | null>(null)
  
  const [isParent, setIsParent] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null)
  const [isCheckingParent, setIsCheckingParent] = useState(true)

  /* ======================================================
      1. CHECK PARENT STATUS
  ====================================================== */
  useEffect(() => {
    const checkParentStatus = async () => {
      if (!user?.id) {
        setIsCheckingParent(false)
        return
      }
      
      try {
        const parentStatus = await isParentUser(user.id)
        setIsParent(parentStatus)
        
        // Sync default filter
        if (parentStatus && !selectedUserId) {
          setSelectedUserId(null) // Menampilkan semua bawahan secara default
        }
      } catch (error) {
        console.error('Error checking parent status:', error)
        setIsParent(false)
      } finally {
        setIsCheckingParent(false)
      }
    }

    checkParentStatus()
  }, [user?.id])

  /* ======================================================
      2. DATA FETCHING (FIXED ARGUMENTS)
  ====================================================== */
  
const { data: agendas = [], isLoading: isLoadingAgendas } = useQuery({
  queryKey: ['agendas', user?.id, selectedUserId, selectedOfficeId, isParent],
  queryFn: async () => {
    if (!user?.id) return [];
    
    if (isParent) {
      // Pastikan urutannya: 1. ID Login, 2. ID Filter User, 3. ID Filter Kantor
      return await getAgendasForParent(
        user.id, 
        selectedUserId, 
        selectedOfficeId
      );
    }
    
    return await getAgendas();
  },
  enabled: !!user?.id && !isCheckingParent
});

  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers
  })

  /* ======================================================
      3. MUTATIONS
  ====================================================== */

  const closeAllModals = useCallback(() => {
    setIsModalOpen(false)
    setIsDetailOpen(false)
    setSelectedAgenda(null)
  }, [])

  const agendaMutation = useMutation({
    mutationFn: (data: Partial<Agenda>) => {
      const id = selectedAgenda?.id ? (selectedAgenda.id as any) : undefined
      return saveAgenda(data, id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendas'] })
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] })
      toast.success(selectedAgenda ? 'Agenda diperbarui' : 'Agenda baru dibuat')
      closeAllModals()
    },
    onError: (error: any) => toast.error(error.message || 'Gagal menyimpan data')
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string | number; status: AgendaStatus }) => 
      updateAgendaStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendas'] })
      toast.success('Status diperbarui')
    },
    onError: (error: any) => toast.error(error.message || 'Gagal mengubah status')
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => deleteAgenda(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendas'] })
      toast.success('Agenda berhasil dihapus')
      closeAllModals()
    },
    onError: (error: any) => toast.error(error.message || 'Gagal menghapus agenda')
  })

  /* ======================================================
      4. EVENT HANDLERS
  ====================================================== */

  const handleAgendaClick = useCallback((agenda: Agenda) => {
    setSelectedAgenda(agenda)
    setIsDetailOpen(true)
  }, [])

  const handleEditFromDetail = (agenda: Agenda) => {
    setSelectedAgenda(agenda)
    setIsDetailOpen(false)
    setTimeout(() => setIsModalOpen(true), 200)
  }

  const handleStatusChange = useCallback((id: string | number, status: AgendaStatus) => {
    statusMutation.mutate({ id, status })
  }, [statusMutation])

  const handleUserSelect = useCallback((userId: string | null) => {
    setSelectedUserId(userId)
  }, [])

  const handleOfficeSelect = useCallback((officeId: string | null) => {
    setSelectedOfficeId(officeId)
  }, [])

  const getSubtitle = () => {
    if (!isParent) return 'Kelola jadwal pribadi Anda secara efisien.'
    if (selectedUserId === user?.id) return 'Menampilkan agenda pribadi Anda.'
    if (!selectedUserId) return 'Menampilkan seluruh agenda tim berdasarkan hirarki.'
    
    const targetMember = users.find(u => String(u.id) === String(selectedUserId))
    return `Menampilkan agenda untuk: ${targetMember?.fullName || 'Anggota Tim'}`
  }

  /* ======================================================
      5. RENDER
  ====================================================== */

  if (isLoadingAgendas || isLoadingUsers || isCheckingParent) {
    return (
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight">Agenda Manager</h1>
          <p className="text-muted-foreground text-lg italic">{getSubtitle()}</p>
        </div>
        <Button 
          onClick={() => {
            setSelectedAgenda(null)
            setIsModalOpen(true)
          }} 
          size="lg"
          className="rounded-full px-8 shadow-xl"
        >
          <span className="mr-2 text-xl">+</span> Agenda Baru
        </Button>
      </div>

      {isParent && (
        <div className="mb-6 bg-card/50 backdrop-blur-sm rounded-2xl border p-6 shadow-sm">
          <AgendaParentFilter
            onUserSelect={handleUserSelect}
            selectedUserId={selectedUserId}
            onOfficeSelect={handleOfficeSelect}
            selectedOfficeId={selectedOfficeId}
          />
        </div>
      )}

      <div className="bg-background/50 backdrop-blur-sm rounded-3xl border p-1">
        <AgendaTabs
          agendas={agendas}
          users={users}
          onAgendaClick={handleAgendaClick}
          onStatusChange={handleStatusChange}
        />
      </div>

      <AgendaDetailModal 
        agenda={selectedAgenda}
        isOpen={isDetailOpen}
        onClose={closeAllModals}
        onStatusChange={handleStatusChange}
        onDelete={(id) => deleteMutation.mutate(id)}
        onEdit={handleEditFromDetail}
        users={users}
        isDeleting={deleteMutation.isPending}
        currentUserId={user?.id}
      />

      <AgendaModal
        isOpen={isModalOpen}
        agenda={selectedAgenda}
        onClose={closeAllModals}
        onSave={(data) => agendaMutation.mutate(data)}
        isLoading={agendaMutation.isPending} 
      />
    </div>
  )
}