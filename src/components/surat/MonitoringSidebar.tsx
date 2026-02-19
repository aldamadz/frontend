import { Search, User, Users, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { SuratRegistrasi } from '@/types/surat';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SidebarProps {
  list: SuratRegistrasi[];
  selectedId?: string;
  activeTab: 'MY_SURAT' | 'OTHERS';
  onTabChange: (tab: 'MY_SURAT' | 'OTHERS') => void;
  onSelect: (id: string) => void;
  onSearch: (term: string) => void;
}

export const MonitoringSidebar = ({ list, selectedId, activeTab, onTabChange, onSelect, onSearch }: SidebarProps) => {
  return (
    <div className="w-96 border-r bg-slate-50/50 flex flex-col h-full shrink-0">
      <div className="p-6 space-y-4 bg-white border-b">
        <h2 className="text-xl font-black text-slate-900 tracking-tight">Tracking Surat</h2>
        
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => onTabChange('MY_SURAT')}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
              activeTab === 'MY_SURAT' ? "bg-white text-primary shadow-sm" : "text-slate-500"
            )}
          >
            <User size={14} /> Surat Saya
          </button>
          <button 
            onClick={() => onTabChange('OTHERS')}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
              activeTab === 'OTHERS' ? "bg-white text-primary shadow-sm" : "text-slate-500"
            )}
          >
            <Users size={14} /> Terkait
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Cari judul atau nomor..." 
            className="pl-10 bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-primary rounded-xl"
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {list.map((s) => {
          const isActive = selectedId === s.id;
          // Cari siapa yang sedang memegang surat saat ini
          const currentSigner = s.surat_signatures?.find(sig => sig.step_order === s.current_step);

          return (
            <div
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={cn(
                "group cursor-pointer rounded-2xl border transition-all duration-300 p-4 relative overflow-hidden",
                isActive 
                  ? "bg-white border-primary shadow-md ring-1 ring-primary/20" 
                  : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
              )}
            >
              <div className="flex justify-between items-start mb-3">
                <Badge variant={s.status === 'SELESAI' ? 'default' : 'secondary'} className="text-[10px] px-2 py-0">
                  {s.status}
                </Badge>
                <span className="text-[10px] font-bold text-slate-400">
                  {new Date(s.created_at).toLocaleDateString('id-ID')}
                </span>
              </div>

              <h4 className={cn(
                "text-sm font-bold leading-snug mb-2 transition-colors",
                isActive ? "text-primary" : "text-slate-800"
              )}>
                {s.judul_surat}
              </h4>

              {/* INFO SINGKAT (Selalu Muncul) */}
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                <Clock size={12} className="text-slate-400" />
                <span>Posisi: </span>
                <span className={cn(
                  "font-bold",
                  s.status === 'SELESAI' ? "text-green-600" : "text-blue-600"
                )}>
                  {s.status === 'SELESAI' ? 'Selesai TTD' : currentSigner?.role_name || 'Menunggu'}
                </span>
              </div>

              {/* DETAIL EKSPANSI (Muncul saat Klik/Aktif) */}
              {isActive && (
                <div className="mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Progress Tanda Tangan</p>
                  <div className="space-y-3">
                    {s.surat_signatures?.sort((a,b) => a.step_order - b.step_order).map((sig) => (
                      <div key={sig.id} className="flex items-center gap-3">
                        <div className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                          sig.is_signed ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-300"
                        )}>
                          {sig.is_signed ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-[11px] font-bold truncate", sig.is_signed ? "text-slate-800" : "text-slate-400")}>
                            {sig.role_name}
                          </p>
                          {sig.is_signed && (
                            <p className="text-[9px] text-green-500 font-medium italic">
                              Sudah TTD
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {!isActive && (
                <div className="absolute right-2 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};