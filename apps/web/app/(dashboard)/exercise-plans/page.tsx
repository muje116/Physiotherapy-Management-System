'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/status-badge';
import { Plus, Dumbbell, CheckCircle, Clock, Loader2, Send } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import { toast } from 'sonner';

interface ExercisePlanCard {
  id: string;
  patient: string;
  name: string;
  exercises: number;
  sendStatus: 'DRAFT' | 'QUEUED' | 'SENT' | 'FAILED';
  sendError: string | null;
  date: string;
  items: string[];
}

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
  patientCode?: string;
}

function mapPlan(plan: any): ExercisePlanCard {
  return {
    id: plan.id,
    patient: plan.patient ? `${plan.patient.firstName} ${plan.patient.lastName}` : 'Unknown patient',
    name: plan.name,
    exercises: plan.items?.length || 0,
    sendStatus: plan.sentAt ? 'SENT' : (plan.sendStatus || 'DRAFT'),
    sendError: plan.sendError || null,
    date: new Date(plan.createdAt).toISOString().split('T')[0],
    items: (plan.items || []).map((item: any) => item.exerciseName),
  };
}

function optionalPositiveNumber(value: string) {
  if (!value.trim()) return undefined;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

export default function ExercisePlansPage() {
  const [plans, setPlans] = useState<ExercisePlanCard[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [formPatientId, setFormPatientId] = useState('');
  const [formName, setFormName] = useState('');
  const [formExerciseName, setFormExerciseName] = useState('');
  const [formBodyRegion, setFormBodyRegion] = useState('');
  const [formSets, setFormSets] = useState('');
  const [formReps, setFormReps] = useState('');
  const [formFrequency, setFormFrequency] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const plansRef = useRef(plans);

  useEffect(() => {
    plansRef.current = plans;
  }, [plans]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansResponse, patientsResponse] = await Promise.all([
        api.get('/exercise-plans', { params: { page: 1, limit: 100 } }),
        api.get('/patients', { params: { page: 1, limit: 100, compact: true } }),
      ]);
      setPlans((plansResponse.data.data || []).map(mapPlan));
      setPatients((patientsResponse.data.data || []).map((patient: any) => ({
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        patientCode: patient.patientCode,
      })));
    } catch (err: any) {
      setError(err.message || err.response?.data?.error?.message || 'Unable to load exercise plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const hasQueuedPlans = plans.some((plan) => plan.sendStatus === 'QUEUED');
  useEffect(() => {
    if (!hasQueuedPlans) return;

    let active = true;
    let requestInFlight = false;
    const refreshStatuses = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const response = await api.get('/exercise-plans', { params: { page: 1, limit: 100 } });
        if (!active) return;
        const updatedPlans = (response.data.data || []).map(mapPlan) as ExercisePlanCard[];
        const previousPlans = plansRef.current;

        for (const plan of updatedPlans) {
          const previous = previousPlans.find((item) => item.id === plan.id);
          if (previous?.sendStatus !== 'QUEUED') continue;
          if (plan.sendStatus === 'SENT') toast.success(`${plan.name} sent to the patient`);
          if (plan.sendStatus === 'FAILED') toast.error(plan.sendError || `Could not send ${plan.name}`);
        }

        setPlans(updatedPlans);
      } catch {
        // Keep polling while queued; a transient status check failure should not hide the plan.
      } finally {
        requestInFlight = false;
      }
    };

    const timer = window.setInterval(() => void refreshStatuses(), 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [hasQueuedPlans]);

  const resetForm = () => {
    setFormPatientId('');
    setFormName('');
    setFormExerciseName('');
    setFormBodyRegion('');
    setFormSets('');
    setFormReps('');
    setFormFrequency('');
    setFormNotes('');
  };

  const openNewPlan = () => {
    resetForm();
    setError(null);
    setDialogOpen(true);
  };

  const savePlan = async () => {
    if (!formPatientId || !formName.trim() || !formExerciseName.trim()) {
      const message = 'Select a patient and enter a plan name and first exercise.';
      setError(message);
      toast.error(message);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.post('/exercise-plans', {
        patientId: formPatientId,
        name: formName.trim(),
        items: [{
          exerciseName: formExerciseName.trim(),
          bodyRegion: formBodyRegion.trim() || undefined,
          sets: optionalPositiveNumber(formSets),
          reps: optionalPositiveNumber(formReps),
          frequency: formFrequency.trim() || undefined,
          notes: formNotes.trim() || undefined,
          order: 0,
        }],
      });
      setDialogOpen(false);
      resetForm();
      toast.success('Exercise plan created');
      await fetchData();
    } catch (err: any) {
      const message = err.message || err.response?.data?.error?.message || 'Unable to create exercise plan';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const sendPlan = async (planId: string) => {
    setSendingId(planId);
    setError(null);
    try {
      await api.post(`/exercise-plans/${planId}/send`);
      setPlans((current) => current.map((plan) => plan.id === planId
        ? { ...plan, sendStatus: 'QUEUED', sendError: null }
        : plan));
      toast.success('Plan queued for delivery');
    } catch (err: any) {
      const message = err.message || err.response?.data?.error?.message || 'Unable to send exercise plan';
      setError(message);
      toast.error(message);
    } finally {
      setSendingId(null);
    }
  };

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Exercise Plans</h1>
          <p className="text-muted-foreground">Create and manage patient exercise programs</p>
        </div>
        <Button onClick={openNewPlan}>
          <Plus className="mr-2 h-4 w-4" /> Create Plan
        </Button>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => void fetchData()}>Retry</Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Create Exercise Plan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Patient</Label>
              <Select
                options={patients.map((patient) => ({
                  value: patient.id,
                  label: `${patient.firstName} ${patient.lastName}${patient.patientCode ? ` (${patient.patientCode})` : ''}`,
                }))}
                placeholder="Select patient"
                value={formPatientId}
                onChange={(event) => setFormPatientId(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Plan name</Label>
              <Input value={formName} onChange={(event) => setFormName(event.target.value)} placeholder="e.g. Shoulder strengthening programme" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First exercise</Label>
                <Input value={formExerciseName} onChange={(event) => setFormExerciseName(event.target.value)} placeholder="e.g. Pendulum swings" />
              </div>
              <div className="space-y-2">
                <Label>Body region</Label>
                <Input value={formBodyRegion} onChange={(event) => setFormBodyRegion(event.target.value)} placeholder="e.g. Shoulder" />
              </div>
              <div className="space-y-2">
                <Label>Sets</Label>
                <Input type="number" min="1" step="1" value={formSets} onChange={(event) => setFormSets(event.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label>Repetitions</Label>
                <Input type="number" min="1" step="1" value={formReps} onChange={(event) => setFormReps(event.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Input value={formFrequency} onChange={(event) => setFormFrequency(event.target.value)} placeholder="e.g. Once daily" />
            </div>
            <div className="space-y-2">
              <Label>Exercise notes</Label>
              <Textarea value={formNotes} onChange={(event) => setFormNotes(event.target.value)} rows={3} placeholder="Technique, precautions, or patient education" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={() => void savePlan()} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create plan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => (
          <Card key={plan.id} className="transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <CardDescription>{plan.patient} · {plan.date} · {plan.exercises} exercises</CardDescription>
                </div>
                <StatusBadge status={plan.sendStatus} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {plan.items.map((item, idx) => (
                  <div key={`${plan.id}-${idx}`} className="flex items-center gap-2 text-sm">
                    <Dumbbell className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>{item}</span>
                  </div>
                ))}
                {plan.items.length === 0 && <p className="text-sm text-muted-foreground">No exercises added yet</p>}
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  {plan.sendStatus === 'SENT'
                    ? <><CheckCircle className="h-3 w-3" /> Sent to patient</>
                    : plan.sendStatus === 'QUEUED'
                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Sending to patient</>
                      : plan.sendStatus === 'FAILED'
                        ? 'Delivery failed'
                        : 'Not sent'}
                </span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {plan.date}</span>
              </div>
              {plan.sendError && <p role="alert" className="mt-3 text-sm text-destructive">{plan.sendError}</p>}
              {plan.sendStatus !== 'SENT' && plan.sendStatus !== 'QUEUED' && (
                <Button variant="outline" size="sm" className="mt-4" onClick={() => void sendPlan(plan.id)} disabled={sendingId === plan.id}>
                  {sendingId === plan.id ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />}
                  {plan.sendStatus === 'FAILED' ? 'Retry delivery' : 'Send to patient'}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {plans.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">No exercise plans found</div>
        )}
      </div>
    </div>
  );
}
