// frontend/src/pages/UserManagementPage.tsx
import { useEffect, useState, useMemo } from 'react';
import { getUsers } from '@/services/user.service';
import { User } from '@/types/agenda';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Edit2, Users, ShieldCheck, User as UserIcon, Search, 
  Plus, MapPin, Building2, Briefcase, Loader2 
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { EditUserModal } from '@/components/users/EditUserModal';
import { AddUserModal } from '@/components/users/AddUserModal';

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [officeFilter, setOfficeFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      console.error("Gagal mengambil data user:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const offices = useMemo(() => {
    const unique = Array.from(new Set(users.map(u => u.officeName).filter(Boolean)));
    return unique.sort();
  }, [users]);

  const departments = useMemo(() => {
    const unique = Array.from(new Set(users.map(u => u.departmentName).filter(Boolean)));
    return unique.sort();
  }, [users]);

  const handleEditClick = (user: User) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        user.fullName.toLowerCase().includes(searchLower) ||
        (user.email && user.email.toLowerCase().includes(searchLower)) ||
        (user.jobTitle && user.jobTitle.toLowerCase().includes(searchLower)) ||
        (user.nik && user.nik.toLowerCase().includes(searchLower));
      
      const matchesOffice = officeFilter === 'all' || user.officeName === officeFilter;
      const matchesDept = deptFilter === 'all' || user.departmentName === deptFilter;

      return matchesSearch && matchesOffice && matchesDept;
    });
  }, [users, searchQuery, officeFilter, deptFilter]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-background text-foreground min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight text-gradient">
            Manajemen User
          </h1>
          <p className="text-muted-foreground text-base max-w-2xl">
            Kelola hak akses, jabatan, lokasi kantor, dan hirarki organisasi dalam ekosistem perusahaan.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-primary/10 text-primary px-4 py-2.5 rounded-xl border border-primary/20 glow-effect">
            <Users className="w-5 h-5" />
            <span className="font-bold text-sm tracking-wide">{filteredUsers.length} Terdaftar</span>
          </div>
          <Button 
            onClick={() => setIsAddModalOpen(true)} 
            className="h-11 px-6 shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition-all hover:scale-[1.02]"
          >
            <Plus className="w-5 h-5 mr-2" /> Tambah Karyawan
          </Button>
        </div>
      </div>

      {/* Filter Toolbar - Menggunakan Glass Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 glass-card p-5 rounded-2xl">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Cari nama, email, NIK atau jabatan..." 
            className="pl-10 bg-secondary/50 border-border focus-visible:ring-primary focus-visible:ring-offset-0"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="relative">
          <Select value={officeFilter} onValueChange={setOfficeFilter}>
            <SelectTrigger className="bg-secondary/50 border-border">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <SelectValue placeholder="Lokasi Kantor" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">Semua Kantor</SelectItem>
              {offices.map(office => (
                <SelectItem key={office} value={office!}>{office}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative">
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="bg-secondary/50 border-border">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                <SelectValue placeholder="Departemen" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">Semua Departemen</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept} value={dept!}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Table Container - Menggunakan Elevated Card */}
      <div className="elevated-card rounded-2xl overflow-hidden border-border/40">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="py-5 font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Karyawan</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Hak Akses</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Jabatan & Unit</TableHead>
              <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Atasan Langsung</TableHead>
              <TableHead className="text-right font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Opsi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-32">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-muted-foreground font-medium animate-pulse">Menghubungkan ke Enterprise Directory...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-32 text-center">
                  <div className="max-w-xs mx-auto space-y-3 opacity-40">
                    <Search className="w-12 h-12 mx-auto" />
                    <p className="text-lg font-medium">Data tidak ditemukan</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredUsers.map((user) => (
              <TableRow key={user.id} className="hover:bg-accent/30 border-border transition-colors">
                <TableCell className="py-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 border-2 border-primary/20 ring-2 ring-background shadow-lg">
                      <AvatarImage src={user.photoUrl} />
                      <AvatarFallback className="bg-secondary text-primary font-extrabold text-sm uppercase">
                        {user.fullName.substring(0,2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-0.5">
                      <span className="font-bold text-sm text-foreground leading-tight tracking-tight">{user.fullName}</span>
                      <span className="text-xs text-primary/70 font-medium lowercase leading-none">{user.email}</span>
                      <span className="text-[10px] text-muted-foreground font-mono mt-1 opacity-80">
                        NIK: {user.nik || '---'}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {user.role === 'admin' ? (
                    <span className="status-badge bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <ShieldCheck className="w-3 h-3 mr-1.5" /> ADMINISTRATOR
                    </span>
                  ) : (
                    <span className="status-badge bg-secondary text-muted-foreground border border-border">
                      <UserIcon className="w-3 h-3 mr-1.5" /> USER / STAFF
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-foreground/90">{user.jobTitle || 'Staff'}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-md font-extrabold uppercase tracking-tight">
                        {user.departmentName || 'Pusat'}
                      </span>
                      <div className="flex items-center text-[10px] text-muted-foreground/80 font-bold bg-accent/40 px-2 py-0.5 rounded-md">
                        <MapPin className="w-2.5 h-2.5 mr-1" />
                        {user.officeName || 'HQ'}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {users.find(u => u.id === user.parentId) ? (
                    <div className="flex items-center gap-2.5">
                       <div className="w-2 h-2 rounded-full bg-success glow-effect" />
                       <span className="text-sm font-medium text-foreground/80 tracking-tight">
                        {users.find(u => u.id === user.parentId)?.fullName}
                       </span>
                    </div>
                  ) : (
                    <span className="text-[10px] px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-bold tracking-widest border border-border">
                      TOP LEVEL
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => handleEditClick(user)} 
                    className="h-9 px-4 font-bold hover:bg-primary hover:text-primary-foreground transition-all rounded-xl border border-border"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-2" /> Kelola
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AddUserModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchUsers}
        allUsers={users}
      />

      <EditUserModal 
        user={selectedUser}
        allUsers={users}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={fetchUsers}
      />
    </div>
  );
}