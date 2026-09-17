'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar, List, Loader2, Plus } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

interface Appointment {
  id: string;
  date: string;
  time: string;
  patient: string;
  therapist: string;
  type: string;
  status: string;
}

interface PatientOption {
  id: string;
  name: string;
}

interface TherapistOption {
  id: string;
  name: string;
}

const APPOINTMENT_TYPE_OPTIONS = [
  { value: 'INITIAL_ASSESSMENT', label: 'Initial Assessment' },
  { value: 'FOLLOW_UP', label: 'Follow Up' },
  { value: 'MANUAL_THERAPY', label: 'Manual Therapy' },
  { value: 'EXERCISE_PRESCRIPTION', label: 'Exercise Prescription' },
  { value: 'TELEHEALTH', label: 'Telehealth' },
  { value: 'GROUP_SESSION', label: 'Group Session' },
];

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [therapists, setTherapists] = useState<TherapistOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [therapistFilter, setTherapistFilter] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formPatientId, setFormPatientId] = useState('');
  const [formTherapistId, setFormTherapistId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formTime, setFormTime] = useState('09:00');
  const [formType, setFormType] = useState('FOLLOW_UP');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/appointments'),
      api.get('/patients', { params: { page: 1, limit: 100 } }),
      api.get('/therapists'),
    ])
      .then(([appointmentsRes, patientsRes, therapistsRes]) => {
        const mappedAppointments = (appointmentsRes.data.data || []).map((appointment: any) => ({
          id: appointment.id,
          date: new Date(appointment.startAt).toISOString().split('T')[0],
          time: new Date(appointment.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          patient: appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : 'Unknown patient',
          therapist: appointment.therapist?.user
            ? `${appointment.therapist.user.firstName} ${appointment.therapist.user.lastName}`
            : 'Unassigned',
          type: appointment.type,
          status: appointment.status,
        }));

        setAppointments(mappedAppointments);
        setPatients((patientsRes.data.data || []).map((patient: any) => ({
          id: patient.id,
          name: `${patient.firstName} ${patient.lastName}`,
        })));
        setTherapists((therapistsRes.data.data || []).map((therapist: any) => ({
          id: therapist.id,
          name: therapist.user ? `${therapist.user.firstName} ${therapist.user.lastName}` : therapist.id,
        })));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setFormPatientId('');
    setFormTherapistId('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormTime('09:00');
    setFormType('FOLLOW_UP');
    setFormNotes('');
  };

  const createAppointment = async () => {
    setSaving(true);
    setError(null);

    const startAt = new Date(`${formDate}T${formTime}:00`);
    const endAt = new Date(startAt.getTime() + 45 * 60 * 1000);

    try {
      await api.post('/appointments', {
        patientId: formPatientId,
        therapistId: formTherapistId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        type: formType,
        isTelehealth: formType === 'TELEHEALTH',
        notes: formNotes || undefined,
      });

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const therapistOptions = useMemo(() => {
    const fromAppointments = Array.from(new Set(appointments.map((appointment) => appointment.therapist)))
      .filter(Boolean)
      .map((therapist) => ({ value: therapist, label: therapist }));

    return fromAppointments;
  }, [appointments]);

  const filtered = appointments.filter((appointment) => {
    const matchesDate = !dateFilter || appointment.date === dateFilter;
    const matchesTherapist = !therapistFilter || appointment.therapist === therapistFilter;
    return matchesDate && matchesTherapist;
  });

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error && appointments.length === 0) {
    return <div className="p-6 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
          <p className="text-muted-foreground">Schedule and manage appointments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" /> New Appointment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Appointment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Patient</Label>
                <Select
                  options={patients.map((patient) => ({ value: patient.id, label: patient.name }))}
                  value={formPatientId}
                  onChange={(e) => setFormPatientId(e.target.value)}
                  placeholder="Select patient"
                />
              </div>
              <div className="space-y-2">
                <Label>Therapist</Label>
                <Select
                  options={therapists.map((therapist) => ({ value: therapist.id, label: therapist.name }))}
                  value={formTherapistId}
                  onChange={(e) => setFormTherapistId(e.target.value)}
                  placeholder="Select therapist"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select options={APPOINTMENT_TYPE_OPTIONS} value={formType} onChange={(e) => setFormType(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={4} />
              </div>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline" onClick={resetForm}>Cancel</Button>
                </DialogClose>
                <Button onClick={createAppointment} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create
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
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="date" className="pl-9" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
            </div>
            <Select
              placeholder="All Therapists"
              options={therapistOptions}
              value={therapistFilter}
              onChange={(e) => setTherapistFilter(e.target.value)}
            />
            <div className="flex overflow-hidden rounded-lg border">
              <Button variant={view === 'list' ? 'default' : 'ghost'} size="sm" className="rounded-none" onClick={() => setView('list')}>
                <List className="mr-1 h-4 w-4" /> List
              </Button>
              <Button variant={view === 'calendar' ? 'default' : 'ghost'} size="sm" className="rounded-none" onClick={() => setView('calendar')}>
                <Calendar className="mr-1 h-4 w-4" /> Calendar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {view === 'list' ? <AppointmentTable appointments={filtered} /> : <AppointmentCalendar appointments={filtered} date={dateFilter} />}
        </CardContent>
      </Card>
    </div>
  );
}

function AppointmentTable({ appointments }: { appointments: Appointment[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Patient</TableHead>
          <TableHead>Therapist</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {appointments.map((appointment) => (
          <TableRow key={appointment.id}>
            <TableCell className="font-medium">{appointment.date} {appointment.time}</TableCell>
            <TableCell>{appointment.patient}</TableCell>
            <TableCell>{appointment.therapist}</TableCell>
            <TableCell>{appointment.type}</TableCell>
            <TableCell><StatusBadge status={appointment.status} /></TableCell>
          </TableRow>
        ))}
        {appointments.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
              No appointments found
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function AppointmentCalendar({ appointments, date }: { appointments: Appointment[]; date: string }) {
  if (appointments.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Calendar className="mx-auto mb-3 h-12 w-12 opacity-50" />
        <p>No appointments scheduled for {date || 'the selected date'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {appointments.map((appointment) => (
        <div key={appointment.id} className="rounded-lg border p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="font-medium">{appointment.time}</p>
              <p className="text-sm text-muted-foreground">{appointment.patient}</p>
            </div>
            <div>
              <p className="text-sm font-medium">{appointment.therapist}</p>
              <p className="text-sm text-muted-foreground">{appointment.type}</p>
            </div>
            <StatusBadge status={appointment.status} />
          </div>
        </div>
      ))}
    </div>
  );
}
