'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

interface AppointmentOption {
  id: string;
  patientId: string;
  patientName: string;
  therapistName: string;
  startAt: string;
}

interface SoapNoteRow {
  id: string;
  appointmentId: string;
  patientId: string;
  date: string;
  patient: string;
  therapist: string;
  signed: boolean;
  painScore: number | null;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  complaint: string;
  painLocation: string;
  symptomsSince: string;
  painPattern: string;
  radiatesTo: string;
  aggravatedBy: string;
  easedBy: string;
  medications: string;
  imagingFindings: string;
  dayNightSymptoms: string;
  presentingHistory: string;
  pastMedicalHistory: string;
  palpationFindings: string;
  rangeOfMotion: string;
  treatmentProvided: string;
}

interface ClinicalForm {
  appointmentId: string;
  patientId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  painScore: string;
  complaint: string;
  painLocation: string;
  symptomsSince: string;
  painPattern: string;
  radiatesTo: string;
  aggravatedBy: string;
  easedBy: string;
  medications: string;
  imagingFindings: string;
  dayNightSymptoms: string;
  presentingHistory: string;
  pastMedicalHistory: string;
  palpationFindings: string;
  rangeOfMotion: string;
  treatmentProvided: string;
}

const emptyForm = (): ClinicalForm => ({
  appointmentId: '',
  patientId: '',
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
  painScore: '',
  complaint: '',
  painLocation: '',
  symptomsSince: '',
  painPattern: '',
  radiatesTo: '',
  aggravatedBy: '',
  easedBy: '',
  medications: '',
  imagingFindings: '',
  dayNightSymptoms: '',
  presentingHistory: '',
  pastMedicalHistory: '',
  palpationFindings: '',
  rangeOfMotion: '',
  treatmentProvided: '',
});

function errorMessage(error: any) {
  return error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Unable to save SOAP note';
}

function formatDate(value: string) {
  return new Date(value).toISOString().split('T')[0];
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function mapNote(note: any): SoapNoteRow {
  return {
    id: note.id,
    appointmentId: note.appointmentId,
    patientId: note.patientId,
    date: formatDate(note.createdAt),
    patient: note.patient ? note.patient.firstName + ' ' + note.patient.lastName : note.patientId,
    therapist: note.appointment?.therapist?.user
      ? note.appointment.therapist.user.firstName + ' ' + note.appointment.therapist.user.lastName
      : note.therapistId,
    signed: Boolean(note.signedAt),
    painScore: note.painScore ?? null,
    subjective: note.subjective || '',
    objective: note.objective || '',
    assessment: note.assessment || '',
    plan: note.plan || '',
    complaint: note.complaint || '',
    painLocation: note.painLocation || '',
    symptomsSince: note.symptomsSince || '',
    painPattern: note.painPattern || '',
    radiatesTo: note.radiatesTo || '',
    aggravatedBy: note.aggravatedBy || '',
    easedBy: note.easedBy || '',
    medications: note.medications || '',
    imagingFindings: note.imagingFindings || '',
    dayNightSymptoms: note.dayNightSymptoms || '',
    presentingHistory: note.presentingHistory || '',
    pastMedicalHistory: note.pastMedicalHistory || '',
    palpationFindings: note.palpationFindings || '',
    rangeOfMotion: note.rangeOfMotion || '',
    treatmentProvided: note.treatmentProvided || '',
  };
}

function formFromNote(note: SoapNoteRow): ClinicalForm {
  return {
    appointmentId: note.appointmentId,
    patientId: note.patientId,
    subjective: note.subjective,
    objective: note.objective,
    assessment: note.assessment,
    plan: note.plan,
    painScore: note.painScore == null ? '' : String(note.painScore),
    complaint: note.complaint,
    painLocation: note.painLocation,
    symptomsSince: note.symptomsSince,
    painPattern: note.painPattern,
    radiatesTo: note.radiatesTo,
    aggravatedBy: note.aggravatedBy,
    easedBy: note.easedBy,
    medications: note.medications,
    imagingFindings: note.imagingFindings,
    dayNightSymptoms: note.dayNightSymptoms,
    presentingHistory: note.presentingHistory,
    pastMedicalHistory: note.pastMedicalHistory,
    palpationFindings: note.palpationFindings,
    rangeOfMotion: note.rangeOfMotion,
    treatmentProvided: note.treatmentProvided,
  };
}

export default function SoapNotesPage() {
  const [notes, setNotes] = useState<SoapNoteRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [therapistFilter, setTherapistFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [form, setForm] = useState<ClinicalForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/soap-notes', { params: { page: 1, limit: 100 } }),
      api.get('/appointments', { params: { page: 1, limit: 100 } }),
    ])
      .then(([notesRes, appointmentsRes]) => {
        setNotes((notesRes.data.data || []).map(mapNote));
        setAppointments((appointmentsRes.data.data || []).map((appointment: any) => ({
          id: appointment.id,
          patientId: appointment.patientId,
          patientName: appointment.patient
            ? appointment.patient.firstName + ' ' + appointment.patient.lastName
            : appointment.patientId,
          therapistName: appointment.therapist?.user
            ? appointment.therapist.user.firstName + ' ' + appointment.therapist.user.lastName
            : appointment.therapistId,
          startAt: appointment.startAt,
        })));
      })
      .catch((requestError) => setError(errorMessage(requestError)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const therapistOptions = useMemo(() => {
    return Array.from(new Set(notes.map((note) => note.therapist)))
      .filter(Boolean)
      .map((therapist) => ({ value: therapist, label: therapist }));
  }, [notes]);

  const filtered = notes.filter((note) => {
    const query = search.toLowerCase();
    const matches = !query
      || note.patient.toLowerCase().includes(query)
      || note.complaint.toLowerCase().includes(query)
      || note.subjective.toLowerCase().includes(query);
    const matchesTherapist = !therapistFilter || note.therapist === therapistFilter;
    return matches && matchesTherapist;
  });

  const editingNote = editingNoteId ? notes.find((note) => note.id === editingNoteId) : null;
  const readOnly = Boolean(editingNote?.signed);
  const appointmentIdsWithNotes = new Set(notes.map((note) => note.appointmentId));
  const appointmentOptions = appointments.filter(
    (appointment) => !appointmentIdsWithNotes.has(appointment.id) || appointment.id === form.appointmentId,
  );

  const openNewNote = () => {
    setEditingNoteId(null);
    setForm(emptyForm());
    setError(null);
    setDialogOpen(true);
  };

  const openNote = (note: SoapNoteRow) => {
    setEditingNoteId(note.id);
    setForm(formFromNote(note));
    setError(null);
    setDialogOpen(true);
  };

  const updateField = (field: keyof ClinicalForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!form.appointmentId || !form.patientId || !form.subjective.trim() || !form.objective.trim() || !form.assessment.trim() || !form.plan.trim()) {
      setError('Appointment, subjective history, objective findings, assessment, and plan are required.');
      return;
    }

    const painScore = form.painScore === '' ? undefined : Number(form.painScore);
    if (painScore !== undefined && (!Number.isInteger(painScore) || painScore < 0 || painScore > 10)) {
      setError('Pain score must be a whole number from 0 to 10.');
      return;
    }

    setSaving(true);
    const payload = {
      appointmentId: form.appointmentId,
      patientId: form.patientId,
      subjective: form.subjective.trim(),
      objective: form.objective.trim(),
      assessment: form.assessment.trim(),
      plan: form.plan.trim(),
      painScore,
      complaint: form.complaint || undefined,
      painLocation: form.painLocation || undefined,
      symptomsSince: form.symptomsSince || undefined,
      painPattern: form.painPattern || undefined,
      radiatesTo: form.radiatesTo || undefined,
      aggravatedBy: form.aggravatedBy || undefined,
      easedBy: form.easedBy || undefined,
      medications: form.medications || undefined,
      imagingFindings: form.imagingFindings || undefined,
      dayNightSymptoms: form.dayNightSymptoms || undefined,
      presentingHistory: form.presentingHistory || undefined,
      pastMedicalHistory: form.pastMedicalHistory || undefined,
      palpationFindings: form.palpationFindings || undefined,
      rangeOfMotion: form.rangeOfMotion || undefined,
      treatmentProvided: form.treatmentProvided || undefined,
    };

    try {
      if (editingNoteId) {
        await api.patch('/soap-notes/' + editingNoteId, payload);
      } else {
        await api.post('/soap-notes', payload);
      }
      setDialogOpen(false);
      setEditingNoteId(null);
      fetchData();
    } catch (requestError: any) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const signNote = async () => {
    if (!editingNoteId || !window.confirm('Sign this clinical note? Signed notes cannot be edited.')) return;

    setError(null);
    setSaving(true);
    try {
      await api.post('/soap-notes/' + editingNoteId + '/sign', { signature: 'confirmed' });
      setDialogOpen(false);
      setEditingNoteId(null);
      fetchData();
    } catch (requestError: any) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="space-y-4 p-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SOAP Notes</h1>
          <p className="text-muted-foreground">Clinical history, examination, assessment, and treatment documentation</p>
        </div>
        <Button onClick={openNewNote}>
          <Plus className="mr-2 h-4 w-4" /> New Note
        </Button>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <Dialog open={dialogOpen} onOpenChange={(nextOpen) => !saving && setDialogOpen(nextOpen)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingNoteId ? 'Clinical note' : 'New clinical note'}</DialogTitle>
          </DialogHeader>
          <form className="space-y-6" onSubmit={saveNote}>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Appointment</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Appointment</Label>
                  <Select
                    options={appointmentOptions.map((appointment) => ({
                      value: appointment.id,
                      label: formatDateTime(appointment.startAt) + ' | ' + appointment.patientName + ' | ' + appointment.therapistName,
                    }))}
                    value={form.appointmentId}
                    disabled={Boolean(editingNoteId)}
                    onChange={(event) => {
                      const appointment = appointments.find((item) => item.id === event.target.value);
                      setForm((current) => ({
                        ...current,
                        appointmentId: event.target.value,
                        patientId: appointment?.patientId || current.patientId,
                      }));
                    }}
                    placeholder="Select appointment"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">History and symptoms</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <ClinicalInput label="Chief complaint (C/O)" value={form.complaint} disabled={readOnly} onChange={(value) => updateField('complaint', value)} />
                <ClinicalInput label="Pain location / body region" value={form.painLocation} disabled={readOnly} onChange={(value) => updateField('painLocation', value)} />
                <ClinicalInput label="Since" value={form.symptomsSince} disabled={readOnly} onChange={(value) => updateField('symptomsSince', value)} />
                <ClinicalInput label="Pain pattern" value={form.painPattern} placeholder="Constant or intermittent" disabled={readOnly} onChange={(value) => updateField('painPattern', value)} />
                <ClinicalInput label="Radiates to" value={form.radiatesTo} disabled={readOnly} onChange={(value) => updateField('radiatesTo', value)} />
                <ClinicalInput label="Medication" value={form.medications} disabled={readOnly} onChange={(value) => updateField('medications', value)} />
                <ClinicalTextArea label="Aggravated by" value={form.aggravatedBy} disabled={readOnly} onChange={(value) => updateField('aggravatedBy', value)} />
                <ClinicalTextArea label="Eased by" value={form.easedBy} disabled={readOnly} onChange={(value) => updateField('easedBy', value)} />
                <ClinicalTextArea label="Imaging / X-ray findings" value={form.imagingFindings} disabled={readOnly} onChange={(value) => updateField('imagingFindings', value)} />
                <ClinicalTextArea label="Day / night symptoms" value={form.dayNightSymptoms} disabled={readOnly} onChange={(value) => updateField('dayNightSymptoms', value)} />
                <ClinicalTextArea label="Presenting history" value={form.presentingHistory} disabled={readOnly} onChange={(value) => updateField('presentingHistory', value)} />
                <ClinicalTextArea label="Past history" value={form.pastMedicalHistory} disabled={readOnly} onChange={(value) => updateField('pastMedicalHistory', value)} />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">SOAP and examination</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <ClinicalTextArea label="Subjective history" required value={form.subjective} disabled={readOnly} onChange={(value) => updateField('subjective', value)} />
                <ClinicalTextArea label="Objective findings" required value={form.objective} disabled={readOnly} onChange={(value) => updateField('objective', value)} />
                <ClinicalTextArea label="Assessment" required value={form.assessment} disabled={readOnly} onChange={(value) => updateField('assessment', value)} />
                <ClinicalTextArea label="Plan" required value={form.plan} disabled={readOnly} onChange={(value) => updateField('plan', value)} />
                <ClinicalTextArea label="Palpation findings" value={form.palpationFindings} disabled={readOnly} onChange={(value) => updateField('palpationFindings', value)} />
                <ClinicalTextArea label="Range of motion (ROM)" value={form.rangeOfMotion} disabled={readOnly} onChange={(value) => updateField('rangeOfMotion', value)} />
              </div>
              <div className="max-w-xs space-y-2">
                <Label>Pain score (0-10)</Label>
                <Input type="number" min="0" max="10" step="1" value={form.painScore} disabled={readOnly} onChange={(event) => updateField('painScore', event.target.value)} />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Treatment</h3>
              <ClinicalTextArea label="Treatment provided" value={form.treatmentProvided} disabled={readOnly} onChange={(value) => updateField('treatmentProvided', value)} />
            </section>

            {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={saving}>Close</Button>
              </DialogClose>
              {editingNoteId && !readOnly && (
                <Button type="button" variant="secondary" disabled={saving} onClick={signNote}>
                  Sign note
                </Button>
              )}
              {!readOnly && (
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingNoteId ? 'Save changes' : 'Save note'}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search patient or complaint..." className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <Select
              placeholder="All Therapists"
              options={therapistOptions}
              value={therapistFilter}
              onChange={(event) => setTherapistFilter(event.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Therapist</TableHead>
                <TableHead>Pain score</TableHead>
                <TableHead>Chief complaint</TableHead>
                <TableHead>Signed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((note) => (
                <TableRow key={note.id}>
                  <TableCell>{note.date}</TableCell>
                  <TableCell className="font-medium">{note.patient}</TableCell>
                  <TableCell>{note.therapist}</TableCell>
                  <TableCell>
                    {note.painScore === null ? '-' : (
                      <span className={note.painScore > 6 ? 'font-medium text-red-600' : note.painScore > 3 ? 'font-medium text-yellow-600' : 'font-medium text-green-600'}>
                        {note.painScore}/10
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate">{note.complaint || note.subjective}</TableCell>
                  <TableCell><StatusBadge status={note.signed ? 'SIGNED' : 'UNSIGNED'} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openNote(note)}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No SOAP notes found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ClinicalInput({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function ClinicalTextArea({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Textarea required={required} rows={3} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
