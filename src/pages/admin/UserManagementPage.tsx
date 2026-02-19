import { useEffect, useState, useMemo } from 'react';
import { getUsers } from '@/services/user.service';
import { User } from '@/types/agenda';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit2, Users, ShieldCheck, User as UserIcon, Search, Plus, MapPin, Building2, Briefcase } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Pastikan ada di komponen UI
import { EditUserModal } from '@/components/users/EditUserModal';
import { AddUserModal } from '@/components/users/AddUserModal';

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State Filter Baru
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

  // Mendapatkan daftar unik Kantor dan Departemen untuk menu dropdown
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

  // Logic filter gabungan (Search + Office + Dept)
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      user.jobTitle.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesOffice = officeFilter === 'all' || user.officeName === officeFilter;
    const matchesDept = deptFilter === 'all' || user.departmentName === deptFilter;

    return matchesSearch && matchesOffice && matchesDept;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen User</h1>
          <p className="text-muted-foreground text-sm">Kelola hak akses, jabatan, lokasi kantor, dan hirarki organisasi.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-lg border border-primary/20">
            <Users className="w-5 h-5" />
            <span className="font-semibold text-sm">{filteredUsers.length} User Terfilter</span>
          </div>
          <Button onClick={() => setIsAddModalOpen(true)} className="shadow-sm">
            <Plus className="w-4 h-4 mr-2" /> Tambah User
          </Button>
        </div>
      </div>

      {/* Kontrol & Filter Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        {/* Search Input */}
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Cari nama, email, atau jabatan..." 
            className="pl-9 bg-background"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Kantor */}
        <div className="relative">
          <Select value={officeFilter} onValueChange={setOfficeFilter}>
            <SelectTrigger className="bg-background">
              <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Pilih Kantor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kantor</SelectItem>
              {offices.map(office => (
                <SelectItem key={office} value={office!}>{office}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filter Departemen */}
        <div className="relative">
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="bg-background">
              <Briefcase className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Departemen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Departemen</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept} value={dept!}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabel User (Tetap sama) */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[300px]">Karyawan</TableHead>
              <TableHead>Hak Akses</TableHead>
              <TableHead>Jabatan & Unit</TableHead>
              <TableHead>Atasan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-20 text-muted-foreground animate-pulse">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="w-8 h-8 opacity-20" />
                    <p>Sinkronisasi data...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">
                  Tidak ada user yang sesuai dengan filter.
                </TableCell>
              </TableRow>
            ) : filteredUsers.map((user) => (
              <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarImage src={user.photoUrl} />
                      <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                        {user.fullName.substring(0,2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm leading-none mb-1.5">{user.fullName}</span>
                      <span className="text-[11px] text-muted-foreground font-mono">{user.nik || 'No NIK'}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {user.role === 'admin' ? (
                    <Badge className="bg-indigo-500/10 text-indigo-600 border-none px-2.5 py-0.5">
                      <ShieldCheck className="w-3 h-3 mr-1" /> Admin
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground px-2.5 py-0.5 font-normal">
                      <UserIcon className="w-3 h-3 mr-1" /> User
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">{user.jobTitle || '-'}</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                        {user.departmentName || 'UMUM'}
                      </span>
                      <div className="flex items-center text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        <MapPin className="w-2.5 h-2.5 mr-1" />
                        {user.officeName || 'PUSAT'}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {users.find(u => u.id === user.parentId)?.fullName || (
                    <span className="text-[11px] italic text-slate-400">Top Level</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleEditClick(user)} className="h-8 hover:text-primary hover:bg-primary/5">
                    <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Edit
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