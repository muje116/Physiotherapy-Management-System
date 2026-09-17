'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Edit, Mail, MapPin, Phone, Calendar, Loader2, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PatientFormDialog } from '@/components/patients/patient-form-dialog';

interface PatientDetail {
  id: string;
  firstName: string;
  lastName: string;
  patientCode: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  dob: string;
  age: number;
  address: unknown;
  status: string;
  therapist: string;
  occupation: string;
  employer: string;
  clinic: string;
  paymentMethod: string;
  paymentResponsibilityAcknowledged: boolean;
  paymentResponsibilitySignedAt: string;
  medicalAid: string;
  membership: string;
  plan: string;
  referralSource: string;
  referralDoctorName: string;
  nextOfKinName: string;
  nextOfKinPhone: string;
  howHeardAboutClinic: string;
  appointments: Array<{
    id: string;
    date: string;
    time: string;
    therapist: string;
    type: string;
    status: string;
  }>;
  soapNotes: Array<{
    id: string;
    date: string;
    therapist: string;
    painScore: string;
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
    signed: boolean;
  }>;
  treatmentPlans: Array<{
    id: string;
    name: string;
    diagnosis: string;
    status: string;
    startDate: string;
    endDate: string;
    notes: string;
    goals: Array<{ description?: string; targetDate?: string; achieved?: boolean }>;
    stages: Array<{ id?: string; name: string; status?: string; durationWeeks?: number | null }>;
  }>;
  invoices: Array<{
    id: string;
    date: string;
    amount: string;
    status: string;
  }>;
  exercisePlans: Array<{
    id: string;
    name: string;
    sent: boolean;
    date: string;
    exercises: number;
  }>;
  outcomeScores: Array<{
    id: string;
    recordedOn: string;
    type: string;
    score: number;
    maxScore: number;
    percentage: number;
    notes: string;
  }>;
  timeline: Array<{ date: string; time: string; event: string; type: string }>;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return '';
  return new Date(value).toISOString().split('T')[0];
}

type OutcomeForm = {
  type: string;
  score: string;
  maxScore: string;
  recordedAt: string;
  notes: string;
};

const OUTCOME_TYPES = [
  { value: 'DASH', label: 'DASH' },
  { value: 'LEFS', label: 'LEFS' },
  { value: 'NDI', label: 'NDI' },
  { value: 'ODI', label: 'ODI' },
  { value: 'PSFS', label: 'PSFS' },
  { value: 'WOMAC', label: 'WOMAC' },
  { value: 'OTHER', label: 'Other' },
];

function emptyOutcomeForm(): OutcomeForm {
  return { type: 'DASH', score: '', maxScore: '100', recordedAt: formatDate(new Date()), notes: '' };
}

function mapOutcomeMeasure(measure: any) {
  return {
    id: measure.id,
    recordedOn: formatDate(measure.recordedAt),
    type: measure.type || 'Other',
    score: Number(measure.score || 0),
    maxScore: Number(measure.maxScore || 0),
    percentage: Number(measure.percentage || 0),
    notes: measure.notes || '',
  };
}

function formatTime(value: string | Date) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function calculateAge(dateOfBirth: string) {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDelta = today.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

function formatAddress(address: unknown) {
  if (typeof address === 'string' && address.trim()) {
    return address;
  }

  if (!address || typeof address !== 'object') {
    return '-';
  }

  const parts = Object.values(address as Record<string, unknown>)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return parts.length > 0 ? parts.join(', ') : '-';
}

export default function PatientDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('profile');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [outcomeDialogOpen, setOutcomeDialogOpen] = useState(false);
  const [editingOutcomeId, setEditingOutcomeId] = useState<string | null>(null);
  const [outcomeForm, setOutcomeForm] = useState<OutcomeForm>(emptyOutcomeForm);
  const [outcomeSaving, setOutcomeSaving] = useState(false);
  const [outcomeError, setOutcomeError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get(`/patients/${id}`),
      api.get(`/patients/${id}/appointments`),
      api.get(`/patients/${id}/soap-notes`),
      api.get(`/patients/${id}/invoices`),
      api.get(`/patients/${id}/exercise-plans`),
      api.get(`/patients/${id}/outcome-measures`),
      api.get(`/patients/${id}/timeline`),
      api.get('/treatment-plans', { params: { patientId: id, page: 1, limit: 100 } })
        .catch(() => ({ data: { data: [] } })),
    ])
      .then(([patientRes, appointmentsRes, notesRes, invoicesRes, plansRes, outcomesRes, timelineRes, treatmentPlansRes]) => {
        const rawPatient = patientRes.data.data;
        const assignedTherapist = rawPatient.therapists?.[0]?.therapist?.user
          ? `${rawPatient.therapists[0].therapist.user.firstName} ${rawPatient.therapists[0].therapist.user.lastName}`
          : 'Unassigned';

        setPatient({
          id: rawPatient.id,
          firstName: rawPatient.firstName,
          lastName: rawPatient.lastName,
          patientCode: rawPatient.patientCode,
          dateOfBirth: rawPatient.dateOfBirth,
          gender: rawPatient.gender || '',
          phone: rawPatient.phone || '',
          email: rawPatient.email || '',
          dob: formatDate(rawPatient.dateOfBirth),
          age: calculateAge(rawPatient.dateOfBirth),
          address: rawPatient.address,
          status: rawPatient.isActive ? 'ACTIVE' : 'INACTIVE',
          therapist: assignedTherapist,
          occupation: rawPatient.occupation || '',
          employer: rawPatient.employer || '',
          clinic: rawPatient.clinic || '',
          paymentMethod: rawPatient.paymentMethod || '',
          paymentResponsibilityAcknowledged: Boolean(rawPatient.paymentResponsibilityAcknowledged),
          paymentResponsibilitySignedAt: rawPatient.paymentResponsibilitySignedAt || '',
          medicalAid: rawPatient.medicalAidName || '',
          membership: rawPatient.medicalAidNo || '',
          plan: rawPatient.medicalAidName || '',
          referralSource: rawPatient.referralSource || rawPatient.referralDoctorName || '',
          referralDoctorName: rawPatient.referralDoctorName || '',
          nextOfKinName: rawPatient.nextOfKinName || '',
          nextOfKinPhone: rawPatient.nextOfKinPhone || '',
          howHeardAboutClinic: rawPatient.howHeardAboutClinic || '',
          appointments: (appointmentsRes.data.data || []).map((appointment: any) => ({
            id: appointment.id,
            date: formatDate(appointment.startAt),
            time: formatTime(appointment.startAt),
            therapist: appointment.therapist?.user
              ? `${appointment.therapist.user.firstName} ${appointment.therapist.user.lastName}`
              : appointment.therapistId,
            type: appointment.type,
            status: appointment.status,
          })),
          soapNotes: (notesRes.data.data || []).map((note: any) => ({
            id: note.id,
            date: formatDate(note.createdAt),
            therapist: note.appointment?.therapist?.user
              ? `${note.appointment.therapist.user.firstName} ${note.appointment.therapist.user.lastName}`
              : note.therapistId,
            painScore: note.painScore == null ? '-' : String(note.painScore),
            subjective: note.subjective || '-',
            objective: note.objective || '-',
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
            signed: Boolean(note.signedAt),
          })),
          invoices: (invoicesRes.data.data || []).map((invoice: any) => ({
            id: invoice.invoiceNumber,
            date: formatDate(invoice.createdAt),
            amount: `R ${Number(invoice.total).toLocaleString()}`,
            status: invoice.status,
          })),
          exercisePlans: (plansRes.data.data || []).map((plan: any) => ({
            id: plan.id,
            name: plan.name,
            sent: Boolean(plan.sentAt),
            date: formatDate(plan.createdAt),
            exercises: plan.items?.length || 0,
          })),
          outcomeScores: (outcomesRes.data.data || []).map(mapOutcomeMeasure).reverse(),
          timeline: (timelineRes.data.data || []).map((item: any) => ({
            date: formatDate(item.date),
            time: formatTime(item.date),
            event: String(item.type || 'event').replace(/_/g, ' '),
            type: item.type,
          })),
          treatmentPlans: (treatmentPlansRes.data.data || []).map((plan: any) => ({
            id: plan.id,
            name: plan.name,
            diagnosis: plan.diagnosis || '',
            status: plan.status,
            startDate: formatDate(plan.startDate),
            endDate: formatDate(plan.endDate),
            notes: plan.notes || '',
            goals: Array.isArray(plan.goals) ? plan.goals : [],
            stages: (plan.stages || []).map((stage: any) => ({
              id: stage.id,
              name: stage.name,
              status: stage.status,
              durationWeeks: stage.durationWeeks,
            })),
          })),
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const refreshOutcomeMeasures = async () => {
    const response = await api.get(`/patients/${id}/outcome-measures`);
    const outcomeScores = (response.data.data || []).map(mapOutcomeMeasure).reverse();
    setPatient((current) => current ? { ...current, outcomeScores } : current);
  };

  const openNewOutcome = () => {
    setEditingOutcomeId(null);
    setOutcomeForm(emptyOutcomeForm());
    setOutcomeError(null);
    setOutcomeDialogOpen(true);
  };

  const openEditOutcome = (measure: PatientDetail['outcomeScores'][number]) => {
    setEditingOutcomeId(measure.id);
    setOutcomeForm({
      type: measure.type,
      score: String(measure.score),
      maxScore: String(measure.maxScore),
      recordedAt: measure.recordedOn,
      notes: measure.notes,
    });
    setOutcomeError(null);
    setOutcomeDialogOpen(true);
  };

  const saveOutcome = async () => {
    const score = Number(outcomeForm.score);
    const maxScore = Number(outcomeForm.maxScore);
    if (!outcomeForm.type.trim() || !Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || score < 0 || score > maxScore) {
      setOutcomeError('Enter a score between zero and the maximum score.');
      return;
    }

    setOutcomeSaving(true);
    setOutcomeError(null);
    try {
      const payload = {
        type: outcomeForm.type.trim(),
        score,
        maxScore,
        recordedAt: outcomeForm.recordedAt ? new Date(`${outcomeForm.recordedAt}T00:00:00`).toISOString() : undefined,
        notes: outcomeForm.notes.trim() || undefined,
      };
      if (editingOutcomeId) {
        await api.patch(`/outcome-measures/${editingOutcomeId}`, payload);
      } else {
        await api.post(`/patients/${id}/outcome-measures`, payload);
      }
      await refreshOutcomeMeasures();
      setOutcomeDialogOpen(false);
      setEditingOutcomeId(null);
    } catch (err: any) {
      setOutcomeError(err.response?.data?.error?.message || err.message || 'Unable to save outcome measure');
    } finally {
      setOutcomeSaving(false);
    }
  };

  const deleteOutcome = async (measureId: string) => {
    if (!window.confirm('Delete this outcome measure?')) return;
    setOutcomeError(null);
    try {
      await api.delete(`/outcome-measures/${measureId}`);
      await refreshOutcomeMeasures();
    } catch (err: any) {
      setOutcomeError(err.response?.data?.error?.message || err.message || 'Unable to delete outcome measure');
    }
  };

  if (loading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-12 w-64" /><Skeleton className="h-96" /></div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">Error: {error}</div>;
  }

  if (!patient) {
    return <div className="p-6 text-muted-foreground">Patient not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar fallback={`${patient.firstName[0]}${patient.lastName[0]}`} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{patient.firstName} {patient.lastName}</h1>
              <StatusBadge status={patient.status} />
            </div>
            <p className="text-muted-foreground">Patient Code: {patient.patientCode} | {patient.therapist}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
          <Edit className="mr-2 h-4 w-4" /> Edit
        </Button>
      </div>
      <PatientFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        patient={patient}
        onSaved={(updated) => setPatient((current) => current ? {
          ...current,
          firstName: updated.firstName,
          lastName: updated.lastName,
          dateOfBirth: updated.dateOfBirth,
          gender: updated.gender || '',
          dob: formatDate(updated.dateOfBirth),
          age: calculateAge(updated.dateOfBirth),
          address: updated.address,
          occupation: updated.occupation || '',
          employer: updated.employer || '',
          clinic: updated.clinic || '',
          paymentMethod: updated.paymentMethod || '',
          paymentResponsibilityAcknowledged: Boolean(updated.paymentResponsibilityAcknowledged),
          paymentResponsibilitySignedAt: updated.paymentResponsibilitySignedAt || '',
          medicalAid: updated.medicalAidName || '',
          membership: updated.medicalAidNo || '',
          plan: updated.medicalAidName || '',
          referralSource: updated.referralSource || updated.referralDoctorName || '',
          referralDoctorName: updated.referralDoctorName || '',
          nextOfKinName: updated.nextOfKinName || '',
          nextOfKinPhone: updated.nextOfKinPhone || '',
          howHeardAboutClinic: updated.howHeardAboutClinic || '',
        } : current)}
      />

      <Dialog open={outcomeDialogOpen} onOpenChange={(nextOpen) => !outcomeSaving && setOutcomeDialogOpen(nextOpen)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOutcomeId ? 'Edit outcome measure' : 'Record outcome measure'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {outcomeError && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{outcomeError}</p>}
            <div className="space-y-2">
              <Label>Measure</Label>
              <Select options={OUTCOME_TYPES} value={outcomeForm.type} onChange={(event) => setOutcomeForm((current) => ({ ...current, type: event.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Score</Label>
                <Input type="number" min="0" step="0.01" value={outcomeForm.score} onChange={(event) => setOutcomeForm((current) => ({ ...current, score: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Maximum score</Label>
                <Input type="number" min="0.01" step="0.01" value={outcomeForm.maxScore} onChange={(event) => setOutcomeForm((current) => ({ ...current, maxScore: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Recorded on</Label>
              <Input type="date" value={outcomeForm.recordedAt} onChange={(event) => setOutcomeForm((current) => ({ ...current, recordedAt: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={outcomeForm.notes} onChange={(event) => setOutcomeForm((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder="Context, interpretation, or test conditions" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOutcomeDialogOpen(false)} disabled={outcomeSaving}>Cancel</Button>
              <Button onClick={() => void saveOutcome()} disabled={outcomeSaving}>
                {outcomeSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingOutcomeId ? 'Save changes' : 'Record measure'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="soap">SOAP Notes</TabsTrigger>
          <TabsTrigger value="treatment">Treatment</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="exercises">Exercise Plans</TabsTrigger>
          <TabsTrigger value="outcomes">Outcome Measures</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /> {patient.phone || '-'}</div>
                <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /> {patient.email || '-'}</div>
                <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" /> {formatAddress(patient.address)}</div>
                <div className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 text-muted-foreground" /> DOB: {patient.dob} (Age {patient.age})</div>
                <div className="text-sm"><span className="text-muted-foreground">Occupation:</span> {patient.occupation || '-'}</div>
                <div className="text-sm"><span className="text-muted-foreground">Employer:</span> {patient.employer || '-'}</div>
                <div className="text-sm"><span className="text-muted-foreground">Clinic:</span> {patient.clinic || '-'}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Medical Aid & Referral</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm"><span className="text-muted-foreground">Provider:</span> {patient.medicalAid || '-'}</div>
                <div className="text-sm"><span className="text-muted-foreground">Membership:</span> {patient.membership || '-'}</div>
                <div className="text-sm"><span className="text-muted-foreground">Plan:</span> {patient.plan || '-'}</div>
                <div className="text-sm"><span className="text-muted-foreground">Payment:</span> {patient.paymentMethod || '-'}</div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Payment responsibility:</span>{' '}
                  {patient.paymentResponsibilityAcknowledged
                    ? 'Acknowledged' + (patient.paymentResponsibilitySignedAt ? ' on ' + formatDate(patient.paymentResponsibilitySignedAt) : '')
                    : 'Not acknowledged'}
                </div>
                <div className="text-sm"><span className="text-muted-foreground">Referring doctor:</span> {patient.referralDoctorName || '-'}</div>
                <div className="text-sm"><span className="text-muted-foreground">Referral source:</span> {patient.referralSource || '-'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Next of kin and intake</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm"><span className="text-muted-foreground">Next of kin:</span> {patient.nextOfKinName || '-'}</div>
                <div className="text-sm"><span className="text-muted-foreground">Kin phone:</span> {patient.nextOfKinPhone || '-'}</div>
                <div className="text-sm"><span className="text-muted-foreground">Heard about clinic:</span> {patient.howHeardAboutClinic || '-'}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="appointments">
          <EntityTable
            headers={['Date', 'Time', 'Therapist', 'Type', 'Status']}
            rows={patient.appointments.map((appointment) => [
              appointment.date,
              appointment.time,
              appointment.therapist,
              appointment.type,
              <StatusBadge key={`${appointment.id}-status`} status={appointment.status} />,
            ])}
            emptyText="No appointments"
          />
        </TabsContent>

        <TabsContent value="soap">
          <div className="space-y-4">
            {patient.soapNotes.map((note) => (
              <Card key={note.id}>
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="text-base">{note.date} | {note.therapist}</CardTitle>
                      <CardDescription>
                        Pain score: {note.painScore === '-' ? 'Not recorded' : `${note.painScore}/10`}
                      </CardDescription>
                    </div>
                    <StatusBadge status={note.signed ? 'SIGNED' : 'UNSIGNED'} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <section>
                    <h3 className="mb-3 text-sm font-semibold">History</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <ClinicalField label="Chief complaint" value={note.complaint || note.subjective} />
                      <ClinicalField label="Pain location" value={note.painLocation} />
                      <ClinicalField label="Since" value={note.symptomsSince} />
                      <ClinicalField label="Pattern" value={note.painPattern} />
                      <ClinicalField label="Radiates to" value={note.radiatesTo} />
                      <ClinicalField label="Aggravated by" value={note.aggravatedBy} />
                      <ClinicalField label="Eased by" value={note.easedBy} />
                      <ClinicalField label="Medication" value={note.medications} />
                      <ClinicalField label="Imaging / X-ray" value={note.imagingFindings} />
                      <ClinicalField label="Day / night symptoms" value={note.dayNightSymptoms} />
                      <ClinicalField label="Presenting history" value={note.presentingHistory} />
                      <ClinicalField label="Past history" value={note.pastMedicalHistory} />
                    </div>
                  </section>
                  <section>
                    <h3 className="mb-3 text-sm font-semibold">Examination</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <ClinicalField label="Objective findings" value={note.objective} />
                      <ClinicalField label="Palpation" value={note.palpationFindings} />
                      <ClinicalField label="Range of motion" value={note.rangeOfMotion} />
                      <ClinicalField label="Assessment" value={note.assessment} />
                    </div>
                  </section>
                  <section>
                    <h3 className="mb-3 text-sm font-semibold">Treatment</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <ClinicalField label="Treatment provided" value={note.treatmentProvided} />
                      <ClinicalField label="Plan" value={note.plan} />
                    </div>
                  </section>
                </CardContent>
              </Card>
            ))}
            {patient.soapNotes.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">No clinical history or treatment notes</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="invoices">
          <EntityTable
            headers={['Invoice #', 'Date', 'Amount', 'Status']}
            rows={patient.invoices.map((invoice) => [
              invoice.id,
              invoice.date,
              invoice.amount,
              <StatusBadge key={`${invoice.id}-invoice`} status={invoice.status} />,
            ])}
            emptyText="No invoices"
          />
        </TabsContent>

        <TabsContent value="exercises">
          <div className="grid gap-4 md:grid-cols-2">
            {patient.exercisePlans.map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    <StatusBadge status={plan.sent ? 'SENT' : 'DRAFT'} />
                  </div>
                  <CardDescription>{plan.date} | {plan.exercises} exercises</CardDescription>
                </CardHeader>
              </Card>
            ))}
            {patient.exercisePlans.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">No exercise plans</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="treatment">
          <div className="space-y-4">
            {patient.treatmentPlans.map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="text-base">{plan.name}</CardTitle>
                      <CardDescription>
                        {plan.diagnosis || 'No diagnosis recorded'} | Started {plan.startDate}
                        {plan.endDate ? ` | Ended ${plan.endDate}` : ''}
                      </CardDescription>
                    </div>
                    <StatusBadge status={plan.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {plan.notes && <ClinicalField label="Treatment approach and notes" value={plan.notes} />}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">Goals</h3>
                      {plan.goals.length > 0 ? (
                        <ul className="space-y-1 text-sm">
                          {plan.goals.map((goal, index) => (
                            <li key={index}>
                              {goal.achieved ? 'Completed: ' : ''}{goal.description || 'Goal'}
                              {goal.targetDate ? ` (target ${goal.targetDate})` : ''}
                            </li>
                          ))}
                        </ul>
                      ) : <p className="text-sm text-muted-foreground">No goals recorded</p>}
                    </div>
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">Stages</h3>
                      {plan.stages.length > 0 ? (
                        <ul className="space-y-1 text-sm">
                          {plan.stages.map((stage) => (
                            <li key={stage.id || stage.name}>
                              {stage.name} <span className="text-muted-foreground">({stage.status || 'NOT_STARTED'})</span>
                            </li>
                          ))}
                        </ul>
                      ) : <p className="text-sm text-muted-foreground">No stages recorded</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {patient.treatmentPlans.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">No treatment plans</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="outcomes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Outcome Measures</CardTitle>
                <CardDescription>Track functional scores over time.</CardDescription>
              </div>
              <Button size="sm" onClick={openNewOutcome}><Plus className="mr-2 h-4 w-4" /> Record measure</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recorded On</TableHead>
                    <TableHead>Measure</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patient.outcomeScores.map((measure) => (
                    <TableRow key={measure.id}>
                      <TableCell>{measure.recordedOn || '-'}</TableCell>
                      <TableCell className="font-medium">{measure.type}</TableCell>
                      <TableCell>{measure.score} / {measure.maxScore}</TableCell>
                      <TableCell>{measure.percentage.toFixed(1)}%</TableCell>
                      <TableCell className="max-w-[240px] truncate">{measure.notes || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditOutcome(measure)}><Edit className="mr-1 h-3 w-3" /> Edit</Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void deleteOutcome(measure.id)}><Trash2 className="mr-1 h-3 w-3" /> Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {patient.outcomeScores.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No outcome measures</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {outcomeError && !outcomeDialogOpen && <p className="text-sm text-destructive">{outcomeError}</p>}
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {patient.timeline.map((item, idx) => (
                  <div key={`${item.type}-${idx}`} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="mt-2 h-2 w-2 rounded-full bg-primary" />
                      {idx < patient.timeline.length - 1 && <div className="w-px flex-1 bg-border" />}
                    </div>
                    <div className="pb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{item.date}</span>
                        <span className="text-muted-foreground">{item.time}</span>
                      </div>
                      <p className="mt-1 text-sm capitalize">{item.event}</p>
                    </div>
                  </div>
                ))}
                {patient.timeline.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">No timeline events</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EntityTable({
  headers,
  rows,
  emptyText,
}: {
  headers: string[];
  rows: ReactNode[][];
  emptyText: string;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={idx}>
                {row.map((cell, cellIdx) => (
                  <TableCell key={cellIdx}>{cell}</TableCell>
                ))}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={headers.length} className="py-8 text-center text-muted-foreground">
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ClinicalField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{value || '-'}</p>
    </div>
  );
}
