import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, CheckSquare, LayoutGrid, List } from 'lucide-react';
import { Agenda, AgendaStatus, User } from '@/types/agenda';
import { AgendaCard } from './AgendaCard';

interface AgendaTabsProps {
  agendas: Agenda[];
  users: User[];
  onAgendaClick: (agenda: Agenda) => void;
  onStatusChange: (agendaId: string, status: AgendaStatus) => void;
}

export const AgendaTabs = ({ agendas, users, onAgendaClick, onStatusChange }: AgendaTabsProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgendas, setSelectedAgendas] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  /* ======================================================
     1. FILTERING & SEARCHING
  ====================================================== */
  const filteredAgendas = useMemo(() => {
    return agendas.filter(agenda => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        agenda.title.toLowerCase().includes(query) ||
        (agenda.description?.toLowerCase().includes(query) ?? false) ||
        (agenda.location?.toLowerCase().includes(query) ?? false);
      
      return matchesSearch;
    });
  }, [agendas, searchQuery]);

  /* ======================================================
     2. GROUPING BY STATUS
  ====================================================== */
  const groupedAgendas = useMemo(() => ({
    Scheduled: filteredAgendas.filter(a => a.status === 'Scheduled'),
    Ongoing: filteredAgendas.filter(a => a.status === 'Ongoing'),
    Completed: filteredAgendas.filter(a => a.status === 'Completed'),
    Overdue: filteredAgendas.filter(a => a.status === 'Overdue'),
  }), [filteredAgendas]);

  /* ======================================================
     3. HELPERS & HANDLERS
  ====================================================== */
  const getOwner = (createdBy?: string | null) => 
    users.find(u => String(u.id) === String(createdBy));

  const toggleAgendaSelection = (agendaId: string | number) => {
    const idStr = String(agendaId);
    setSelectedAgendas(prev => 
      prev.includes(idStr) 
        ? prev.filter(id => id !== idStr)
        : [...prev, idStr]
    );
  };

  const handleBulkComplete = () => {
    selectedAgendas.forEach(id => onStatusChange(id, 'Completed'));
    setSelectedAgendas([]);
  };

  return (
    <div className="w-full space-y-6">
      {/* TOP CONTROLS */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-background/50 p-4 rounded-2xl border border-border/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari agenda atau lokasi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full lg:w-80 bg-background border-border/50 focus-visible:ring-primary/20"
            />
          </div>
          <Button variant="outline" size="icon" className="shrink-0 lg:hidden">
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          <AnimatePresence>
            {selectedAgendas.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-2"
              >
                <span className="text-xs font-medium text-muted-foreground mr-2">
                  {selectedAgendas.length} dipilih
                </span>
                <Button 
                  onClick={handleBulkComplete} 
                  size="sm" 
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full transition-all shadow-lg shadow-emerald-500/20"
                >
                  <CheckSquare className="w-4 h-4" />
                  Selesaikan Massal
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <Separator orientation="vertical" className="h-8 hidden lg:block" />

          <div className="flex bg-muted p-1 rounded-lg">
            <Button 
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* TABS SYSTEM */}
      <Tabs defaultValue="Ongoing" className="w-full">
        <TabsList className="inline-flex h-12 items-center justify-start rounded-xl bg-muted/50 p-1 text-muted-foreground w-full lg:w-auto overflow-x-auto no-scrollbar">
          {(Object.keys(groupedAgendas) as Array<keyof typeof groupedAgendas>).map((status) => (
            <TabsTrigger 
              key={status} 
              value={status} 
              className="rounded-lg px-6 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              {status}
              <Badge 
                variant="secondary" 
                className={`ml-2 px-1.5 py-0 text-[10px] rounded-md ${
                  status === 'Overdue' ? 'bg-rose-500/10 text-rose-600' : 
                  status === 'Ongoing' ? 'bg-amber-500/10 text-amber-600' :
                  status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600' :
                  'bg-blue-500/10 text-blue-600'
                }`}
              >
                {groupedAgendas[status].length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(groupedAgendas).map(([status, items]) => (
          <TabsContent key={status} value={status} className="mt-6 outline-none ring-0">
            <AnimatePresence mode="popLayout">
              {items.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-center justify-center py-24 border-2 border-dashed rounded-3xl border-muted bg-muted/20"
                >
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 text-muted-foreground/30">
                    <Search className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground/70">Tidak ada agenda {status.toLowerCase()}</h3>
                  <p className="text-muted-foreground text-sm mt-1 max-w-xs text-center">
                    Coba sesuaikan kata kunci pencarian atau filter yang Anda gunakan.
                  </p>
                </motion.div>
              ) : (
                <motion.div 
                  layout
                  className={
                    viewMode === 'grid' 
                      ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" 
                      : "flex flex-col gap-3"
                  }
                >
                  {items.map((agenda, index) => (
                    <AgendaCard
                      key={agenda.id}
                      agenda={agenda}
                      owner={getOwner(agenda.createdBy)}
                      index={index}
                      isSelected={selectedAgendas.includes(String(agenda.id))}
                      onSelect={() => toggleAgendaSelection(agenda.id)}
                      onClick={() => onAgendaClick(agenda)}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};