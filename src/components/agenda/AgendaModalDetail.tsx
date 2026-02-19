import { 
  Calendar, 
  Clock, 
  MapPin, 
  User as UserIcon, 
  CheckCircle2, 
  Trash2, 
  Edit3, 
  X,
  Timer
} from 'lucide-react'
import { format, intervalToDuration, isValid } from 'date-fns'
import { id as localeID } from 'date-fns/locale'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Agenda, AgendaStatus, User } from '@/types/agenda'

interface AgendaDetailModalProps {
  agenda: Agenda | null
  isOpen: boolean
  onClose: () => void
  onStatusChange: (id: string | number, status: AgendaStatus) => void
  onDelete: (id: string | number) => void
  onEdit: (agenda: Agenda) => void
  users: User[]
  isDeleting?: boolean
  currentUserId: string | null // Tambahkan prop ini untuk identifikasi user
}

export function AgendaDetailModal({
  agenda,
  isOpen,
  onClose,
  onStatusChange,
  onDelete,
  onEdit,
  users,
  isDeleting = false,
  currentUserId
}: AgendaDetailModalProps) {
  if (!agenda) return null

  // --- LOGIKA OTORISASI ---
  // Kita cek apakah user yang sedang login adalah orang yang membuat agenda ini
  const isOwner = String(currentUserId) === String(agenda.createdBy);

  // --- HELPER FUNCTIONS ---
  const getSafeDate = (dateVal: any) => {
    const d = new Date(dateVal);
    return isValid(d) ? d : null;
  };

  const formatSafe = (dateVal: any, formatStr: string, options?: any) => {
    const d = getSafeDate(dateVal);
    return d ? format(d, formatStr, options) : 'Waktu tidak valid';
  };

  const creator = users.find((u) => String(u.id) === String(agenda.createdBy))

  const startDate = getSafeDate(agenda.startTime);
  const endDate = getSafeDate(agenda.endTime);
  
  let durationText = '0 menit';
  if (startDate && endDate) {
    const duration = intervalToDuration({ start: startDate, end: endDate });
    durationText = [
      duration.hours ? `${duration.hours} jam` : '',
      duration.minutes ? `${duration.minutes} menit` : ''
    ].filter(Boolean).join(' ') || '0 menit';
  }

  const statusColors: Record<AgendaStatus, string> = {
    Scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
    Ongoing: 'bg-amber-100 text-amber-700 border-amber-200',
    Completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Overdue: 'bg-rose-100 text-rose-700 border-rose-200',
    Deleted: 'bg-slate-100 text-slate-700 border-slate-200',
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] gap-0 p-0 overflow-hidden outline-none [&>button:last-child]:hidden">
        <div className={`h-2 w-full ${agenda.status === 'Completed' ? 'bg-emerald-500' : 'bg-primary'}`} />
        
        <div className="p-6">
          <DialogHeader>
            <div className="flex justify-between items-start">
              <Badge variant="outline" className={`${statusColors[agenda.status]} font-medium`}>
                {agenda.status}
              </Badge>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <DialogTitle className="text-2xl font-bold mt-4 leading-tight">
              {agenda.title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Rincian lengkap mengenai agenda {agenda.title}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-6">
            {agenda.description && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-foreground/80 leading-relaxed italic">
                  "{agenda.description}"
                </p>
              </div>
            )}

            <div className="grid gap-y-4">
              <div className="flex items-center gap-4 text-sm">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Tanggal</span>
                  <span className="font-medium text-foreground">
                    {formatSafe(agenda.startTime, 'EEEE, dd MMMM yyyy', { locale: localeID })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Waktu & Durasi</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {formatSafe(agenda.startTime, 'HH:mm')} — {formatSafe(agenda.endTime, 'HH:mm')}
                    </span>
                    <Badge variant="secondary" className="text-[10px] h-5 flex gap-1 items-center font-normal">
                      <Timer className="h-3 w-3" /> {durationText}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Lokasi</span>
                  <span className="font-medium">{agenda.location || 'Tidak ada lokasi'}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <UserIcon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Dibuat Oleh</span>
                  <span className="font-medium text-primary">
                    {creator?.fullName || 'User tidak ditemukan'}
                  </span>
                </div>
              </div>
            </div>

            {/* SEKSI AKSI: Hanya tampil jika user adalah pemilik agenda (bukan parent/atasan) */}
            {isOwner ? (
              <>
                <Separator className="my-2" />
                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-full px-4"
                      onClick={() => onEdit(agenda)}
                      disabled={isDeleting}
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-full px-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onDelete(agenda.id)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {isDeleting ? 'Menghapus...' : 'Hapus'}
                    </Button>
                  </div>

                  {agenda.status !== 'Completed' && (
                    <Button 
                      size="sm" 
                      className="rounded-full px-6 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200"
                      onClick={() => onStatusChange(agenda.id, 'Completed')}
                      disabled={isDeleting}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Selesai
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="pt-4 text-center">
                <Separator className="mb-4" />
                <p className="text-xs text-muted-foreground italic">
                  Anda sedang melihat agenda bawahan (Mode Baca-Saja)
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}