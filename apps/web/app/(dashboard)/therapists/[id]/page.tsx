'use client';

import { useEffect, useState } from 'react';
import { Edit, Mail, Phone, Users, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

interface TherapistDetail {
  id: string;
  firstName: string;
  lastName: string;
  reg: string;
  specialties: string[];
  bio: string;
  isActive: boolean;
  phone: string;
  email: string;
  utilisation: number;
  patients: number;
  schedule: Array<{ day: string; start: string; end: string; type: string }>;
  assignedPatients: Array<{ id: string; name: string; lastAppt: string; status: string }>;
  performance: Array<{ metric: string; value: string }>;
}

function formatDate(value: string | Date) {
  return new Date(value).toISOString().split('T')[0];
}

function formatTime(value: string | Date) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function buildRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);

  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
}

export default function TherapistDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [therapist, setTherapist] = useState<TherapistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [formRegistrationNo, setFormRegistrationNo] = useState('');
  const [formSpecialties, setFormSpecialties] = useState('');
  const [formBio, setFormBio] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  useEffect(() => {
    const range = buildRange();

    Promise.all([
      api.get(`/therapists/${id}`),
      api.get(`/therapists/${id}/schedule`, { params: range }),
      api.get(`/therapists/${id}/patients`),
      api.get(`/therapists/${id}/utilisation`, { params: range }),
    ])
      .then(([detailRes, scheduleRes, patientsRes, utilisationRes]) => {
        const rawTherapist = detailRes.data.data;
        const rawSchedule = scheduleRes.data.data || [];
        const rawPatients = patientsRes.data.data || [];
        const rawUtilisation = utilisationRes.data.data || {};

        setTherapist({
          id: rawTherapist.id,
          firstName: rawTherapist.user?.firstName || '',
          lastName: rawTherapist.user?.lastName || '',
          reg: rawTherapist.registrationNo || 'No registration number',
          specialties: rawTherapist.specialties || [],
          bio: rawTherapist.bio || '',
          isActive: rawTherapist.isActive !== false,
          phone: rawTherapist.user?.phone || '-',
          email: rawTherapist.user?.email || '-',
          utilisation: rawUtilisation.utilisation || 0,
          patients: rawTherapist._count?.patients || rawPatients.length,
          schedule: rawSchedule.map((block: any) => ({
            day: formatDate(block.startAt),
            start: formatTime(block.startAt),
            end: formatTime(block.endAt),
            type: block.type || 'AVAILABLE',
          })),
          assignedPatients: rawPatients.map((patient: any) => ({
            id: patient.patientCode || patient.id,
            name: `${patient.firstName} ${patient.lastName}`,
            lastAppt: patient._count?.appointments
              ? `${patient._count.appointments} appointment(s)`
              : 'No appointments',
            status: patient.isActive ? 'ACTIVE' : 'INACTIVE',
          })),
          performance: [
            { metric: 'Utilisation', value: `${rawUtilisation.utilisation || 0}%` },
            { metric: 'Booked Minutes', value: String(rawUtilisation.bookedMinutes || 0) },
            { metric: 'Available Minutes', value: String(rawUtilisation.totalAvailableMinutes || 0) },
            { metric: 'Active Patients', value: String(rawTherapist._count?.patients || rawPatients.length) },
          ],
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const openEdit = () => {
    if (!therapist) return;
    setFormRegistrationNo(therapist.reg === 'No registration number' ? '' : therapist.reg);
    setFormSpecialties(therapist.specialties.join(', '));
    setFormBio(therapist.bio);
    setFormIsActive(therapist.isActive);
    setError(null);
    setEditDialogOpen(true);
  };

  const saveEdit = async () => {
    if (!therapist) return;
    setEditSaving(true);
    setError(null);
    try {
      const response = await api.patch(`/therapists/${therapist.id}`, {
        registrationNo: formRegistrationNo.trim() || undefined,
        specialties: formSpecialties.split(',').map((value) => value.trim()).filter(Boolean),
        bio: formBio.trim() || undefined,
        isActive: formIsActive,
      });
      const updated = response.data.data;
      setTherapist((current) => current ? {
        ...current,
        reg: updated.registrationNo || 'No registration number',
        specialties: updated.specialties || [],
        bio: updated.bio || '',
        isActive: updated.isActive !== false,
      } : current);
      setEditDialogOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Unable to update therapist');
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-12 w-64" /><Skeleton className="h-96" /></div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">Error: {error}</div>;
  }

  if (!therapist) {
    return <div className="p-6 text-muted-foreground">Therapist not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar fallback={`${therapist.firstName[0]}${therapist.lastName[0]}`} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Dr. {therapist.firstName} {therapist.lastName}</h1>
              <Badge variant="outline">{therapist.reg}</Badge>
            </div>
            <p className="text-muted-foreground">
              {therapist.specialties.length > 0 ? therapist.specialties.join(' | ') : 'No specialties listed'}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={openEdit}>
          <Edit className="mr-2 h-4 w-4" /> Edit
        </Button>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Therapist Profile</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Registration number</Label>
              <Input value={formRegistrationNo} onChange={(event) => setFormRegistrationNo(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Specialties</Label>
              <Input value={formSpecialties} onChange={(event) => setFormSpecialties(event.target.value)} placeholder="Sports, Orthopaedics" />
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea value={formBio} onChange={(event) => setFormBio(event.target.value)} rows={4} placeholder="Professional bio and areas of focus" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formIsActive} onChange={(event) => setFormIsActive(event.target.checked)} />
              Active therapist
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={editSaving}>Cancel</Button>
              <Button onClick={() => void saveEdit()} disabled={editSaving}>
                {editSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact & Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /> {therapist.phone}</div>
              <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /> {therapist.email}</div>
              <div className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-muted-foreground" /> {therapist.patients} assigned patients</div>
              {therapist.bio && <p className="pt-2 text-sm text-muted-foreground">{therapist.bio}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Schedule Blocks</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {therapist.schedule.map((block, idx) => (
                    <TableRow key={`${block.day}-${block.start}-${idx}`}>
                      <TableCell className="font-medium">{block.day}</TableCell>
                      <TableCell>{block.start}</TableCell>
                      <TableCell>{block.end}</TableCell>
                      <TableCell>{block.type}</TableCell>
                    </TableRow>
                  ))}
                  {therapist.schedule.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        No schedule blocks in the last 30 days
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {therapist.performance.map((metric) => (
                <div key={metric.metric}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{metric.metric}</span>
                    <span className="font-medium">{metric.value}</span>
                  </div>
                  <Separator className="mt-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assigned Patients</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {therapist.assignedPatients.map((patient) => (
                <div key={patient.id} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{patient.name}</p>
                    <p className="text-xs text-muted-foreground">{patient.id} | Last: {patient.lastAppt}</p>
                  </div>
                  <Badge variant={patient.status === 'ACTIVE' ? 'success' : 'neutral'}>{patient.status}</Badge>
                </div>
              ))}
              {therapist.assignedPatients.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">No patients assigned</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
