import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import { getChildUsers } from '@/services/parent-user.service'; 
import { Users, Loader2, Building2, UserCircle, ChevronRight } from 'lucide-react';

interface AgendaParentFilterProps {
  onUserSelect: (userId: string | null) => void;
  selectedUserId: string | null;
  onOfficeSelect: (officeId: string | null) => void;
  selectedOfficeId: string | null;
}

export function AgendaParentFilter({ 
  onUserSelect, 
  selectedUserId, 
  onOfficeSelect, 
  selectedOfficeId 
}: AgendaParentFilterProps) {
  const { user } = useAuth() as any;

  // 1. Ambil daftar kantor untuk dropdown Area
  const { data: offices = [] } = useQuery({
    queryKey: ['offices-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offices')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // 2. Ambil user secara REKURSIF berdasarkan hirarki atasan
  const { data: childUsers = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['visible-users-recursive', user?.id],
    queryFn: () => getChildUsers(user?.id),
    enabled: !!user?.id,
  });

  // 3. Logika Grouping User berdasarkan Kantor
  const filteredAndGrouped = useMemo(() => {
    const filtered = selectedOfficeId 
      ? childUsers.filter((u: any) => String(u.office_id) === String(selectedOfficeId))
      : childUsers;

    return filtered.reduce((acc: Record<string, any[]>, curr: any) => {
      const officeName = curr.offices?.name || 'KANTOR CABANG';
      if (!acc[officeName]) acc[officeName] = [];
      acc[officeName].push(curr);
      return acc;
    }, {});
  }, [childUsers, selectedOfficeId]);

  const getInitials = (name: string) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Helper untuk tampilan label saat ini
  const selectedChild = childUsers.find((u: any) => String(u.id) === String(selectedUserId));
  const isMeSelected = String(selectedUserId) === String(user?.id);

  const currentOfficeLabel = useMemo(() => {
    if (!selectedOfficeId || selectedOfficeId === 'all_offices') return "Seluruh Cabang";
    const found = offices.find((o: any) => String(o.id) === String(selectedOfficeId));
    return found ? found.name : "Area Kantor";
  }, [selectedOfficeId, offices]);

  return (
    <div className="flex flex-col sm:flex-row items-end gap-3 w-full">
      
      {/* FILTER 1: AREA KANTOR */}
      <div className="flex-1 w-full space-y-1.5">
        <Label className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground flex items-center gap-1.5 ml-1">
          <Building2 className="h-3 w-3" /> Area Kantor
        </Label>
        <Select
          value={selectedOfficeId || "all_offices"} 
          onValueChange={(val) => {
            onOfficeSelect(val === 'all_offices' ? null : val);
            // Reset ke 'all' saat ganti kantor agar data tidak 'ngawur' 
            // menunjuk user dari kantor sebelumnya
            onUserSelect('all'); 
          }}
        >
          <SelectTrigger className="h-9 bg-background border-border/60 rounded-xl text-[11px] font-bold shadow-sm transition-all hover:border-primary/30">
            <SelectValue>{currentOfficeLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl shadow-xl">
            <SelectItem value="all_offices" className="text-[11px] font-medium text-primary">
              Seluruh Cabang (Semua Level)
            </SelectItem>
            {offices.map((off: any) => (
              <SelectItem key={off.id} value={String(off.id)} className="text-[11px]">
                {off.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* FILTER 2: ANGGOTA TIM */}
      <div className="flex-[1.5] w-full space-y-1.5">
        <Label className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground flex items-center gap-1.5 ml-1">
          <Users className="h-3 w-3" /> Hirarki Anggota Tim
        </Label>
        <Select
          value={selectedUserId || 'all'}
          onValueChange={(value) => onUserSelect(value)}
          disabled={isLoadingUsers}
        >
          <SelectTrigger className="h-9 bg-background border-border/60 rounded-xl text-[11px] shadow-sm transition-all hover:border-primary/30">
            <SelectValue>
              {isMeSelected ? (
                <div className="flex items-center gap-2">
                  <UserCircle className="h-3.5 w-3.5 text-primary" />
                  <span className="font-bold">Agenda Saya (Pribadi)</span>
                </div>
              ) : (selectedUserId === 'all' || !selectedUserId) ? (
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span className="font-bold">Seluruh Anggota Tim</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5 border border-primary/20">
                    <AvatarImage src={(selectedChild as any)?.avatar_url} />
                    <AvatarFallback className="text-[8px] font-bold bg-muted">
                      {getInitials((selectedChild as any)?.full_name || '')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-bold truncate max-w-[150px]">
                    {(selectedChild as any)?.full_name}
                  </span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>

          <SelectContent className="max-h-[400px] rounded-2xl shadow-xl border-primary/10">
            {/* OPSI 1: DIRI SENDIRI */}
            <SelectItem value={String(user?.id)} className="rounded-lg">
              <div className="flex items-center gap-2 py-0.5">
                <UserCircle className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-bold">Agenda Saya (Pribadi)</span>
              </div>
            </SelectItem>

            {/* OPSI 2: SEMUA TIM */}
            <SelectItem value="all" className="rounded-lg">
              <div className="flex items-center gap-2 py-0.5 text-primary font-bold text-[11px]">
                <Users className="h-4 w-4" />
                <span>Seluruh Anggota Tim</span>
              </div>
            </SelectItem>

            <div className="h-px bg-border/50 my-1.5" />

            {/* LIST BAWAHAN REKURSIF */}
            {isLoadingUsers ? (
              <div className="p-4 flex justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-primary/40" />
              </div>
            ) : (
              Object.entries(filteredAndGrouped).map(([officeName, members]) => (
                <SelectGroup key={officeName}>
                  <SelectLabel className="px-2 py-1.5 text-[9px] font-black text-primary/60 uppercase bg-primary/5 mb-1 sticky top-0 z-10 rounded-sm">
                    {officeName}
                  </SelectLabel>
                  
                  {members.map((child: any) => (
                    <SelectItem 
                      key={child.id} 
                      value={String(child.id)} 
                      className="pl-2 rounded-lg"
                    >
                      <div className="flex items-center gap-1 py-0.5">
                        {/* Visual Indentasi untuk Level Hirarki */}
                        {Array.from({ length: child.depth || 0 }).map((_, i) => (
                          <div key={i} className="w-3 border-l h-5 ml-1.5 border-primary/20" />
                        ))}
                        
                        {child.depth > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50 mr-0.5" />}
                        
                        <Avatar className="h-6 w-6 border border-border/60">
                          <AvatarImage src={child.avatar_url} />
                          <AvatarFallback className="text-[8px] font-bold">
                            {getInitials(child.full_name || '')}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex flex-col leading-tight min-w-0 ml-1">
                          <span className={`text-[11px] truncate ${child.depth === 0 ? 'font-bold' : 'font-medium text-muted-foreground'}`}>
                            {child.full_name}
                          </span>
                          <span className="text-[8px] text-muted-foreground/70 font-mono uppercase">
                            {child.nik || 'STAFF'}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}