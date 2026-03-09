import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { picService } from '@/services/pic.service';
import { PICReviewDetail } from '@/components/pic/PICReviewDetail';
import { Search, FileText, Loader2, Inbox, MessageSquare, User, X,
         Building2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

const getStatusBadge = (status: string | null) => {
  switch (status) {
    case 'SPK':              return { label: 'SPK',          cls: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20', Icon: CheckCircle2 };
    case 'KEUANGAN':         return { label: 'Keuangan',     cls: 'text-blue-600 bg-blue-500/10 border-blue-500/20',        Icon: CheckCircle2 };
    case 'REJECTED':         return { label: 'Ditolak',      cls: 'text-red-600 bg-red-500/10 border-red-500/20',           Icon: XCircle };
    case 'KEUANGAN_DONE':    return { label: 'Keu. Selesai', cls: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20', Icon: CheckCircle2 };
    case 'KEUANGAN_REJECTED':return { label: 'Keu. Tolak',  cls: 'text-red-600 bg-red-500/10 border-red-500/20',           Icon: XCircle };
    case 'PENDING':          return { label: 'Menunggu',     cls: 'text-amber-600 bg-amber-500/10 border-amber-500/20',     Icon: Clock };
    default:                 return { label: 'Review',       cls: 'text-slate-500 bg-slate-500/10 border-slate-500/20',     Icon: Clock };
  }
};

const MonitoringPICPage = () => {
  const [selectedSurat, setSelectedSurat] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [deptInfo, setDeptInfo] = useState<{ name: string } | null>(null);
  const queryClient = useQueryClient();

  // Auth + ambil dept info PIC
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles').select('id, full_name, role').eq('id', user.id).single();
      setCurrentUser(profile);

      // Ambil departemen yang di-handle PIC ini
      const { data: deptPics } = await supabase
        .from('master_dept_pics')
        .select('dept_id, master_departments(name)')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (deptPics?.master_departments) {
        setDeptInfo({ name: (deptPics.master_departments as any).name });
      }
    };
    init();
  }, []);

  const { data: queue = [], isLoading, refetch } = useQuery({
    queryKey: ['review-queue'],
    queryFn: () => picService.getReviewQueue(),
    enabled: !!currentUser,
  });

  // Realtime sync
  useEffect(() => {
    const channel = supabase
      .channel('pic-queue-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'surat_registrasi' }, (payload) => {
        refetch();
        if (selectedSurat) {
          const isProcessed = payload.eventType === 'UPDATE' &&
            payload.new.id === selectedSurat.id &&
            payload.new.pic_action_at !== null;
          if (isProcessed) setSelectedSurat(null);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedSurat, refetch]);

  const filteredQueue = queue.filter(item =>
    item.judul_surat?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.no_surat?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Toaster position="top-right" />

      {/* HEADER */}
      <header className="px-6 py-4 border-b border-border bg-card/50 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-xl font-black tracking-tighter text-primary">ANTREAN REVIEW PIC</h1>
              {deptInfo && (
                <span className="flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded border bg-primary/10 text-primary border-primary/20">
                  <Building2 size={10} /> {deptInfo.name}
                </span>
              )}
            </div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
              Dokumen yang memerlukan review departemen Anda
            </p>
          </div>
          <div className="relative min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Cari dokumen atau nomor surat..."
              className="w-full pl-10 pr-4 py-2 bg-secondary/50 border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex overflow-hidden">

        {/* SIDEBAR */}
        <div className="w-[350px] lg:w-[400px] shrink-0 flex flex-col border-r border-border bg-card/10">
          <div className="p-4 border-b border-border bg-secondary/5 flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Inbox size={12} /> Antrean ({filteredQueue.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="animate-spin text-primary mb-2" size={24} />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Memuat data...</span>
              </div>
            ) : filteredQueue.length === 0 ? (
              <div className="p-12 text-center opacity-40">
                <Inbox className="mx-auto mb-4" size={40} />
                <p className="text-xs font-bold uppercase tracking-tight">Tidak ada antrean</p>
                <p className="text-[10px] text-muted-foreground mt-1">Semua dokumen sudah diproses</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {filteredQueue.map((item: any) => {
                  const badge = getStatusBadge(item.pic_review_status);
                  const isActive = selectedSurat?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedSurat(item)}
                      className={`p-4 cursor-pointer transition-all hover:bg-secondary/40 flex gap-3 relative border-l-2 ${
                        isActive ? 'bg-secondary border-primary' : 'border-transparent'
                      }`}
                    >
                      {item.chat_status === 'OPEN' && (
                        <span className="absolute top-3 right-3 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1.5">
                          <div className={`flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded border ${badge.cls}`}>
                            <badge.Icon size={10} /> {badge.label}
                          </div>
                          <span className="text-[9px] text-muted-foreground font-mono">
                            {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true, locale: localeID })}
                          </span>
                        </div>
                        <h3 className={`text-sm font-bold truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>
                          {item.judul_surat}
                        </h3>
                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate opacity-70">
                          {item.no_surat || '—'}
                        </p>
                        {item.profiles?.[0]?.full_name && (
                          <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-1">
                            <User size={9} /> {item.profiles[0].full_name}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* PANEL DETAIL */}
        <div className="flex-1 bg-secondary/5 relative overflow-hidden">
          {selectedSurat ? (
            <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="absolute top-4 right-6 z-50">
                <button
                  onClick={() => setSelectedSurat(null)}
                  className="p-2 bg-background/80 backdrop-blur shadow-sm border border-border rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 h-full">
                <PICReviewDetail
                  surat={selectedSurat}
                  onActionComplete={() => {
                    setSelectedSurat(null);
                    queryClient.invalidateQueries({ queryKey: ['review-queue'] });
                    refetch();
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-40">
              <div className="w-20 h-20 bg-card rounded-full flex items-center justify-center mb-6 border border-border">
                <MessageSquare className="text-muted-foreground/20" size={40} />
              </div>
              <h2 className="text-xs font-black tracking-[0.3em] text-muted-foreground uppercase">Pilih Dokumen</h2>
              <p className="text-[10px] text-muted-foreground/60 mt-2 font-bold uppercase tracking-widest">
                Klik salah satu daftar untuk memulai review
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default MonitoringPICPage;