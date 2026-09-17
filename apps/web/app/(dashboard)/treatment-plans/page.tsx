'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Loader2, ChevronDown, ChevronRight, CheckCircle2, Circle, XCircle } from 'lucide-react';
import api from '@/lib/api';

interface TreatmentPlanGoal {
  id?: string; description: string; targetDate: string; achieved?: boolean;
}

interface TreatmentPlanStage {
  id?: string; name: string; description: string; durationWeeks: number; order: number; progress?: number;
}

interface TreatmentPlan {
  id: string;
  patientId: string;
  patientName: string;
  planName: string;
  diagnosis: string;
  notes: string;
  status: string;
  startDate: string;
  goals: TreatmentPlanGoal[];
  stages: TreatmentPlanStage[];
  stageCount?: number;
  completedStageCount?: number;
}

interface Patient {
  id: string; firstName: string; lastName: string;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const STAGE_PROGRESS_COLORS = ['bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];

export default function TreatmentPlansPage() {
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const [planDialog, setPlanDialog] = useState(false);
  const [editPlanId, setEditPlanId] = useState<string | null>(null);
  const [formPatientId, setFormPatientId] = useState('');
  const [formPlanName, setFormPlanName] = useState('');
  const [formDiagnosis, setFormDiagnosis] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formGoals, setFormGoals] = useState<TreatmentPlanGoal[]>([{ description: '', targetDate: '' }]);
  const [formStages, setFormStages] = useState<TreatmentPlanStage[]>([{ name: '', description: '', durationWeeks: 4, order: 1 }]);
  const [patientSearch, setPatientSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const formatDate = (value?: string | null) => (value ? new Date(value).toISOString().split('T')[0] : '');

  const fetchData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/treatment-plans', { params: { page: 1, limit: 100, status: statusFilter || undefined } }),
      api.get('/patients'),
    ]).then(([tpRes, ptRes]) => {
      const plansData = (tpRes.data.data || []).map((p: any) => ({
        id: p.id,
        patientId: p.patientId,
        patientName: p.patient ? `${p.patient.firstName} ${p.patient.lastName}` : p.patientId,
        planName: p.name,
        diagnosis: p.diagnosis || '-',
        notes: p.notes || '',
        status: p.status,
        startDate: formatDate(p.startDate),
        goals: Array.isArray(p.goals) ? p.goals : [],
        stages: (p.stages || []).map((stage: any) => ({
          id: stage.id,
          name: stage.name,
          description: stage.description || '',
          durationWeeks: stage.durationWeeks || 0,
          order: stage.order,
          progress: stage.status === 'COMPLETED' ? 100 : stage.status === 'IN_PROGRESS' ? 50 : 0,
        })),
        stageCount: p.stages?.length || 0,
        completedStageCount: p.stages?.filter((s: any) => s.status === 'COMPLETED').length || 0,
      }));
      setPlans(plansData);
      setPatients(ptRes.data.data || []);
    }).catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [statusFilter]);

  const resetPlanForm = () => {
    setFormPatientId('');
    setFormPlanName('');
    setFormDiagnosis('');
    setFormNotes('');
    setFormGoals([{ description: '', targetDate: '' }]);
    setFormStages([{ name: '', description: '', durationWeeks: 4, order: 1 }]);
    setEditPlanId(null);
    setPatientSearch('');
  };

  const openNewPlan = () => { resetPlanForm(); setPlanDialog(true); };

  const openEditPlan = async (planId: string) => {
    try {
      const res = await api.get(`/treatment-plans/${planId}`);
      const plan = res.data.data;
      setEditPlanId(planId);
      setFormPatientId(plan.patientId || '');
      setFormPlanName(plan.name || '');
      setFormDiagnosis(plan.diagnosis || '');
      setFormNotes(plan.notes || '');
      setFormGoals(Array.isArray(plan.goals) && plan.goals.length ? plan.goals : [{ description: '', targetDate: '' }]);
      setFormStages(plan.stages?.length ? plan.stages.map((s: any, i: number) => ({
        id: s.id,
        name: s.name,
        description: s.description || '',
        durationWeeks: s.durationWeeks || 0,
        order: s.order || i + 1,
        progress: s.status === 'COMPLETED' ? 100 : s.status === 'IN_PROGRESS' ? 50 : 0,
      })) : [{ name: '', description: '', durationWeeks: 4, order: 1 }]);
      setPlanDialog(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const savePlan = async () => {
    setSaving(true);
    try {
      const payload = {
        patientId: formPatientId,
        name: formPlanName,
        diagnosis: formDiagnosis,
        notes: formNotes || undefined,
        goals: formGoals.filter(g => g.description),
        stages: formStages.filter(s => s.name).map((s, i) => ({
          name: s.name,
          description: s.description,
          durationWeeks: s.durationWeeks,
          order: i + 1,
        })),
      };
      if (editPlanId) {
        await api.patch(`/treatment-plans/${editPlanId}`, payload);
      } else {
        await api.post('/treatment-plans', payload);
      }
      setPlanDialog(false);
      resetPlanForm();
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const completePlan = async (planId: string) => {
    try {
      await api.post(`/treatment-plans/${planId}/complete`);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateStageProgress = async (planId: string, stageId: string, progress: number) => {
    try {
      await api.patch(`/treatment-plans/${planId}/stages/${stageId}`, { progress });
      setPlans(prev => prev.map(p => {
        if (p.id !== planId) return p;
        const stages = p.stages.map(s => s.id === stageId ? { ...s, progress } : s);
        return { ...p, stages, completedStageCount: stages.filter(s => s.progress === 100).length };
      }));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addGoal = () => setFormGoals([...formGoals, { description: '', targetDate: '' }]);
  const removeGoal = (i: number) => setFormGoals(formGoals.filter((_, idx) => idx !== i));
  const updateGoal = (i: number, field: keyof TreatmentPlanGoal, value: string) => {
    const updated = [...formGoals];
    (updated[i] as any)[field] = value;
    setFormGoals(updated);
  };

  const addStage = () => setFormStages([...formStages, { name: '', description: '', durationWeeks: 4, order: formStages.length + 1 }]);
  const removeStage = (i: number) => setFormStages(formStages.filter((_, idx) => idx !== i));
  const updateStage = (i: number, field: keyof TreatmentPlanStage, value: any) => {
    const updated = [...formStages];
    (updated[i] as any)[field] = value;
    setFormStages(updated);
  };

  const toggleExpand = (id: string) => setExpandedId(expandedId === id ? null : id);

  const filteredPatients = patients.filter(p =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(patientSearch.toLowerCase())
  );

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Treatment Plans</h1>
        <p className="text-muted-foreground">Create and manage patient treatment plans</p>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{plans.length} plan(s)</p>
          <Select options={STATUS_OPTIONS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44" />
        </div>
        <Dialog open={planDialog} onOpenChange={setPlanDialog}>
          <DialogTrigger asChild>
            <Button onClick={openNewPlan}><Plus className="h-4 w-4 mr-2" /> New Plan</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editPlanId ? 'Edit Plan' : 'New Treatment Plan'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Patient</Label>
                <Input placeholder="Search patient..." value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} />
                <div className="max-h-32 overflow-y-auto border rounded-md p-1">
                  {filteredPatients.map(p => (
                    <div
                      key={p.id}
                      className={`px-3 py-1.5 text-sm rounded cursor-pointer ${formPatientId === p.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                      onClick={() => { setFormPatientId(p.id); setPatientSearch(`${p.firstName} ${p.lastName}`); }}
                    >
                      {p.firstName} {p.lastName}
                    </div>
                  ))}
                  {filteredPatients.length === 0 && <p className="text-xs text-muted-foreground p-2">No patients found</p>}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Plan Name</Label>
                  <Input value={formPlanName} onChange={(e) => setFormPlanName(e.target.value)} placeholder="e.g. ACL Rehabilitation" />
                </div>
                <div className="space-y-2">
                  <Label>Diagnosis</Label>
                  <Input value={formDiagnosis} onChange={(e) => setFormDiagnosis(e.target.value)} placeholder="e.g. ACL Tear" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Treatment approach and clinical notes</Label>
                <Textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Record the intended treatment approach, precautions, and education to carry through the plan."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Goals</Label>
                  <Button variant="outline" size="sm" onClick={addGoal}><Plus className="h-3 w-3 mr-1" /> Add Goal</Button>
                </div>
                {formGoals.map((goal, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1">
                      <Input value={goal.description} onChange={(e) => updateGoal(idx, 'description', e.target.value)} placeholder="Goal description" />
                    </div>
                    <div className="w-36 space-y-1">
                      <Input type="date" value={goal.targetDate} onChange={(e) => updateGoal(idx, 'targetDate', e.target.value)} />
                    </div>
                    {formGoals.length > 1 && (
                      <Button variant="ghost" size="icon" className="mt-0" onClick={() => removeGoal(idx)}>
                        <XCircle className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Stages</Label>
                  <Button variant="outline" size="sm" onClick={addStage}><Plus className="h-3 w-3 mr-1" /> Add Stage</Button>
                </div>
                {formStages.map((stage, idx) => (
                  <div key={idx} className="p-3 border rounded-md space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Stage {idx + 1}</span>
                      {formStages.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeStage(idx)}>
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input value={stage.name} onChange={(e) => updateStage(idx, 'name', e.target.value)} placeholder="Stage name" />
                      <Input type="number" value={stage.durationWeeks} onChange={(e) => updateStage(idx, 'durationWeeks', parseInt(e.target.value) || 0)} placeholder="Duration (weeks)" />
                    </div>
                    <Textarea value={stage.description} onChange={(e) => updateStage(idx, 'description', e.target.value)} placeholder="Stage description" rows={2} />
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <DialogClose asChild><Button variant="outline" onClick={resetPlanForm}>Cancel</Button></DialogClose>
                <Button onClick={savePlan} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {editPlanId ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Diagnosis</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map(plan => (
                <>
                  <TableRow key={plan.id} className="cursor-pointer" onClick={() => toggleExpand(plan.id)}>
                    <TableCell>
                      {expandedId === plan.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </TableCell>
                    <TableCell className="font-medium">{plan.patientName}</TableCell>
                    <TableCell>{plan.planName}</TableCell>
                    <TableCell>{plan.diagnosis}</TableCell>
                    <TableCell><StatusBadge status={plan.status} /></TableCell>
                    <TableCell>{plan.startDate}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all rounded-full"
                            style={{ width: `${(plan.stageCount ?? 0) > 0 ? ((plan.completedStageCount || 0) / (plan.stageCount ?? 1)) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {(plan.completedStageCount ?? 0)}/{(plan.stageCount ?? 0)} stages
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditPlan(plan.id); }}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      {plan.status === 'ACTIVE' && (
                        <Button variant="ghost" size="sm" className="text-green-600" onClick={(e) => { e.stopPropagation(); completePlan(plan.id); }}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedId === plan.id && (
                    <TableRow key={`${plan.id}-detail`}>
                      <TableCell colSpan={8} className="bg-muted/30 p-4">
                        <div className="grid gap-6 md:grid-cols-2">
                          <div>
                            <h4 className="text-sm font-semibold mb-3">Stages</h4>
                            <div className="space-y-3">
                              {plan.stages?.map(stage => (
                                <div key={stage.id || stage.name} className="space-y-1">
                                  <div className="flex justify-between text-sm">
                                    <span className="font-medium">{stage.name}</span>
                                    <span className="text-muted-foreground">{stage.durationWeeks} weeks</span>
                                  </div>
                                  {stage.description && <p className="text-xs text-muted-foreground">{stage.description}</p>}
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all ${STAGE_PROGRESS_COLORS[Math.min(Math.floor((stage.progress || 0) / 25), 3)]}`}
                                        style={{ width: `${stage.progress || 0}%` }} />
                                    </div>
                                    <span className="text-xs font-medium w-10 text-right">{stage.progress || 0}%</span>
                                  </div>
                                  <div className="flex gap-1 mt-1">
                                    {[0, 25, 50, 75, 100].map(val => (
                                      <Button key={val} size="sm" variant="outline" className="h-6 text-xs px-2"
                                        onClick={() => updateStageProgress(plan.id, stage.id!, val)}>
                                        {val}%
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              {(!plan.stages || plan.stages.length === 0) && (
                                <p className="text-xs text-muted-foreground">No stages defined</p>
                              )}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold mb-3">Goals</h4>
                            <div className="space-y-2">
                              {plan.goals?.map((goal, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                  {goal.achieved
                                    ? <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                    : <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                  }
                                  <div>
                                    <p className="text-sm">{goal.description}</p>
                                    <p className="text-xs text-muted-foreground">Target: {goal.targetDate}</p>
                                  </div>
                                </div>
                              ))}
                              {(!plan.goals || plan.goals.length === 0) && (
                                <p className="text-xs text-muted-foreground">No goals defined</p>
                              )}
                            </div>
                          </div>
                        </div>
                        {plan.notes && (
                          <div className="mt-6">
                            <h4 className="mb-2 text-sm font-semibold">Treatment approach and notes</h4>
                            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{plan.notes}</p>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
              {plans.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No treatment plans found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
