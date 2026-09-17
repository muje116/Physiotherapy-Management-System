'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PatientFormDialog } from '@/components/patients/patient-form-dialog';

interface PatientRow {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  lastAppointment: string;
  status: string;
  therapist: string;
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [therapistFilter, setTherapistFilter] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 8;

  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchPatients = () => {
    setLoading(true);
    setError(null);
    api.get('/patients', { params: { page: 1, limit: 100 } })
      .then((res) => {
        const rows = (res.data.data || []).map((patient: any) => ({
          id: patient.id,
          patientCode: patient.patientCode,
          firstName: patient.firstName,
          lastName: patient.lastName,
          phone: patient.phone || '-',
          email: patient.email || '-',
          lastAppointment: patient._count?.appointments ? `${patient._count.appointments} appointment(s)` : 'No appointments',
          status: patient.isActive ? 'ACTIVE' : 'INACTIVE',
          therapist: patient.therapists?.[0]?.therapist?.user
            ? `${patient.therapists[0].therapist.user.firstName} ${patient.therapists[0].therapist.user.lastName}`
            : 'Unassigned',
        }));
        setPatients(rows);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const therapistOptions = useMemo(() => {
    return Array.from(new Set(patients.map((patient) => patient.therapist)))
      .filter((therapist) => therapist && therapist !== 'Unassigned')
      .map((therapist) => ({ value: therapist, label: therapist }));
  }, [patients]);

  const filtered = patients.filter((patient) => {
    const name = `${patient.firstName} ${patient.lastName}`.toLowerCase();
    const matchesSearch = !search
      || name.includes(search.toLowerCase())
      || patient.patientCode.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || patient.status === statusFilter;
    const matchesTherapist = !therapistFilter || patient.therapist === therapistFilter;
    return matchesSearch && matchesStatus && matchesTherapist;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  if (loading) {
    return <div className="space-y-4 p-6"><div className="h-8 w-48 animate-pulse rounded bg-muted" /><div className="h-64 animate-pulse rounded bg-muted" /></div>;
  }

  if (error && patients.length === 0) {
    return <div className="p-6 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Patients</h1>
          <p className="text-muted-foreground">Manage your patient records</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Patient
        </Button>
        <PatientFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSaved={fetchPatients}
        />
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or patient code..."
                className="pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              placeholder="All Statuses"
              options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            />
            <Select
              placeholder="All Therapists"
              options={therapistOptions}
              value={therapistFilter}
              onChange={(e) => {
                setTherapistFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Appointments</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell>
                    <Link href={`/patients/${patient.id}`} className="font-medium text-primary hover:underline">
                      {patient.patientCode}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/patients/${patient.id}`} className="hover:underline">
                      {patient.firstName} {patient.lastName}
                    </Link>
                  </TableCell>
                  <TableCell>{patient.phone}</TableCell>
                  <TableCell>{patient.email}</TableCell>
                  <TableCell>{patient.lastAppointment}</TableCell>
                  <TableCell><StatusBadge status={patient.status} /></TableCell>
                </TableRow>
              ))}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No patients found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filtered.length === 0 ? 0 : (currentPage - 1) * perPage + 1}-{Math.min(currentPage * perPage, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <Button key={pageNumber} variant={pageNumber === currentPage ? 'default' : 'outline'} size="sm" onClick={() => setPage(pageNumber)}>
                  {pageNumber}
                </Button>
              ))}
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
