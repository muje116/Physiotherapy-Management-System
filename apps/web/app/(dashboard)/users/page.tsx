'use client';

import { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, RotateCcw, Search, UserX } from 'lucide-react';
import api from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeNumber?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  phone?: string | null;
  hireDate?: string | null;
  role: string;
  isActive: boolean;
}

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'THERAPIST', label: 'Therapist' },
  { value: 'FRONT_DESK', label: 'Front Desk' },
  { value: 'BILLING', label: 'Billing' },
];

const FILTER_ROLE_OPTIONS = [{ value: '', label: 'All Roles' }, ...ROLE_OPTIONS];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formEmployeeNumber, setFormEmployeeNumber] = useState('');
  const [formJobTitle, setFormJobTitle] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formHireDate, setFormHireDate] = useState('');
  const [formRole, setFormRole] = useState('THERAPIST');
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    setError(null);
    api.get('/users', { params: { page: 1, limit: 100 } })
      .then((res) => setUsers(res.data.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const resetForm = () => {
    setEditingUser(null);
    setFormEmail('');
    setFormPassword('');
    setFormFirstName('');
    setFormLastName('');
    setFormEmployeeNumber('');
    setFormJobTitle('');
    setFormDepartment('');
    setFormPhone('');
    setFormHireDate('');
    setFormRole('THERAPIST');
    setFormActive(true);
  };

  const openNewUser = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    setFormEmail(user.email);
    setFormPassword('');
    setFormFirstName(user.firstName);
    setFormLastName(user.lastName);
    setFormEmployeeNumber(user.employeeNumber || '');
    setFormJobTitle(user.jobTitle || '');
    setFormDepartment(user.department || '');
    setFormPhone(user.phone || '');
    setFormHireDate(user.hireDate ? new Date(user.hireDate).toISOString().slice(0, 10) : '');
    setFormRole(user.role);
    setFormActive(user.isActive);
    setDialogOpen(true);
  };

  const saveUser = async () => {
    setSaving(true);
    setError(null);

    try {
      if (editingUser) {
        await api.patch(`/users/${editingUser.id}`, {
          firstName: formFirstName,
          lastName: formLastName,
          employeeNumber: formEmployeeNumber || null,
          jobTitle: formJobTitle || null,
          department: formDepartment || null,
          phone: formPhone || null,
          hireDate: formHireDate ? new Date(`${formHireDate}T00:00:00`).toISOString() : null,
          role: formRole,
          isActive: formActive,
        });
      } else {
        const userResponse = await api.post('/users', {
          email: formEmail,
          password: formPassword,
          firstName: formFirstName,
          lastName: formLastName,
          employeeNumber: formEmployeeNumber || undefined,
          jobTitle: formJobTitle || undefined,
          department: formDepartment || undefined,
          phone: formPhone || undefined,
          hireDate: formHireDate ? new Date(`${formHireDate}T00:00:00`).toISOString() : undefined,
          role: formRole,
        });
        if (formRole === 'THERAPIST') {
          await api.post('/therapists', { userId: userResponse.data.data.id });
        }
      }

      setDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deactivateUser = async (userId: string) => {
    try {
      await api.delete(`/users/${userId}`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetPassword = async (userId: string) => {
    const newPassword = window.prompt('Enter a new password (minimum 8 characters):');
    if (!newPassword) return;

    try {
      await api.post(`/users/${userId}/reset-password`, { newPassword });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filtered = users.filter((user) => {
    const name = `${user.firstName} ${user.lastName}`.toLowerCase();
    const matchesSearch = !search
      || name.includes(search.toLowerCase())
      || user.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !roleFilter || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return <div className="space-y-4 p-6"><Skeleton /><Skeleton /><Skeleton /></div>;
  }

  if (error && users.length === 0) {
    return <div className="p-6 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hospital Employees</h1>
          <p className="text-muted-foreground">Manage physiotherapists, administrators, front desk, and billing staff</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewUser}>
              <Plus className="mr-2 h-4 w-4" /> Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input value={formFirstName} onChange={(e) => setFormFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input value={formLastName} onChange={(e) => setFormLastName(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Employee Number</Label><Input value={formEmployeeNumber} onChange={(e) => setFormEmployeeNumber(e.target.value)} placeholder="Optional" /></div>
                <div className="space-y-2"><Label>Job Title</Label><Input value={formJobTitle} onChange={(e) => setFormJobTitle(e.target.value)} placeholder="e.g. Senior Physiotherapist" /></div>
                <div className="space-y-2"><Label>Department</Label><Input value={formDepartment} onChange={(e) => setFormDepartment(e.target.value)} placeholder="Clinical, Billing, Front Desk" /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} /></div>
                <div className="space-y-2"><Label>Hire Date</Label><Input type="date" value={formHireDate} onChange={(e) => setFormHireDate(e.target.value)} /></div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} disabled={Boolean(editingUser)} />
              </div>
              {!editingUser && (
                <div className="space-y-2">
                  <Label>Temporary Password</Label>
                  <Input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} />
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select options={ROLE_OPTIONS} value={formRole} onChange={(e) => setFormRole(e.target.value)} />
                </div>
                {editingUser && (
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      options={[
                        { value: 'true', label: 'Active' },
                        { value: 'false', label: 'Inactive' },
                      ]}
                      value={String(formActive)}
                      onChange={(e) => setFormActive(e.target.value === 'true')}
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline" onClick={resetForm}>Cancel</Button>
                </DialogClose>
                <Button onClick={saveUser} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {editingUser ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select options={FILTER_ROLE_OPTIONS} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
               <TableHead>Employee</TableHead>
               <TableHead>Email</TableHead>
               <TableHead>Department</TableHead>
               <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar fallback={`${user.firstName[0]}${user.lastName[0]}`} size="sm" />
                      <span className="font-medium">{user.firstName} {user.lastName}</span>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell><div>{user.department || '-'}</div><div className="text-xs text-muted-foreground">{user.jobTitle || user.employeeNumber || ''}</div></TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell><StatusBadge status={user.isActive ? 'ACTIVE' : 'INACTIVE'} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditUser(user)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => resetPassword(user.id)}>
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                      {user.isActive && (
                        <Button variant="ghost" size="sm" onClick={() => deactivateUser(user.id)}>
                          <UserX className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No employees found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Skeleton() {
  return <div className="h-4 w-full animate-pulse rounded bg-muted" />;
}
