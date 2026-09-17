'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/status-badge';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Loader2, Send, CheckCircle2, CheckSquare, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';

interface ClientTask {
  id: string;
  patientId: string;
  patientName: string;
  therapistName: string;
  title: string;
  description: string;
  taskType: string;
  status: string;
  dueDate: string;
  emailSent: boolean;
}

interface ClientTaskStats {
  total: number; pending: number; sent: number; completed: number; overdue: number; completionRate: string;
}

interface Patient {
  id: string; firstName: string; lastName: string;
}

const TASK_TYPE_OPTIONS = [
  { value: 'EXERCISE', label: 'Exercise' },
  { value: 'MEDICATION', label: 'Medication' },
  { value: 'READING', label: 'Reading' },
  { value: 'ASSESSMENT', label: 'Assessment' },
];

const TASK_STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SENT', label: 'Sent' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const TASK_TYPE_BADGE: Record<string, 'default' | 'secondary' | 'outline' | 'info' | 'warning'> = {
  EXERCISE: 'default',
  MEDICATION: 'warning',
  READING: 'secondary',
  ASSESSMENT: 'info',
};

export default function ClientTasksPage() {
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [stats, setStats] = useState<ClientTaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterPatient, setFilterPatient] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const [taskDialog, setTaskDialog] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [formPatientId, setFormPatientId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTaskType, setFormTaskType] = useState('EXERCISE');
  const [formDueDate, setFormDueDate] = useState('');
  const [formAutoEmail, setFormAutoEmail] = useState(true);
  const [saving, setSaving] = useState(false);

  const formatDate = (value?: string | null) => (value ? new Date(value).toISOString().split('T')[0] : '');

  const fetchData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/client-tasks'),
      api.get('/patients'),
      api.get('/client-tasks/stats'),
    ]).then(([tRes, pRes, sRes]) => {
      setTasks((tRes.data.data || []).map((task: any) => ({
        id: task.id,
        patientId: task.patientId,
        patientName: task.patient ? `${task.patient.firstName} ${task.patient.lastName}` : task.patientId,
        therapistName: task.therapist?.user ? `${task.therapist.user.firstName} ${task.therapist.user.lastName}` : task.therapistId,
        title: task.title,
        description: task.description || '',
        taskType: task.taskType,
        status: task.status,
        dueDate: formatDate(task.dueDate),
        emailSent: Boolean(task.emailSentAt) || task.status === 'SENT' || task.status === 'COMPLETED',
      })));
      setPatients(pRes.data.data || []);
      setStats(sRes.data.data || null);
    }).catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setFormPatientId('');
    setFormTitle('');
    setFormDescription('');
    setFormTaskType('EXERCISE');
    setFormDueDate('');
    setFormAutoEmail(true);
    setEditTaskId(null);
  };

  const openNewTask = () => { resetForm(); setTaskDialog(true); };

  const openEditTask = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      setEditTaskId(taskId);
      setFormPatientId(task.patientId);
      setFormTitle(task.title);
      setFormDescription(task.description || '');
      setFormTaskType(task.taskType);
      setFormDueDate(task.dueDate);
      setFormAutoEmail(!task.emailSent);
      setTaskDialog(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveTask = async () => {
    setSaving(true);
    try {
      const payload = { patientId: formPatientId, title: formTitle, description: formDescription, taskType: formTaskType, dueDate: formDueDate, autoSendEmail: formAutoEmail };
      if (editTaskId) {
        await api.patch(`/client-tasks/${editTaskId}`, payload);
      } else {
        await api.post('/client-tasks', payload);
      }
      setTaskDialog(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const markComplete = async (taskId: string) => {
    try {
      await api.post(`/client-tasks/${taskId}/complete`);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const sendEmail = async (taskId: string) => {
    try {
      await api.post(`/client-tasks/${taskId}/send-email`);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (filterPatient && t.patientName !== filterPatient) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterType && t.taskType !== filterType) return false;
    if (filterDateFrom && t.dueDate < filterDateFrom) return false;
    if (filterDateTo && t.dueDate > filterDateTo) return false;
    return true;
  });

  const todayStr = new Date().toISOString().split('T')[0];

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Client Tasks</h1>
        <p className="text-muted-foreground">Assign and track tasks for your patients</p>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {stats && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pending</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-yellow-600">{stats.pending}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Sent</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-blue-600">{stats.sent}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Completed</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{stats.completed}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Overdue</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-600">{stats.overdue}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Completion Rate</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.completionRate}</p></CardContent></Card>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filteredTasks.length} task(s)</p>
        <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
          <DialogTrigger asChild>
            <Button onClick={openNewTask}><Plus className="h-4 w-4 mr-2" /> New Task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editTaskId ? 'Edit Task' : 'New Client Task'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Patient</Label>
                <Select
                  options={patients.map(p => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))}
                  value={formPatientId}
                  onChange={(e) => setFormPatientId(e.target.value)}
                  placeholder="Select patient"
                />
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="e.g. Perform hamstring stretches" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} placeholder="Detailed task description" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Task Type</Label>
                  <Select options={TASK_TYPE_OPTIONS} value={formTaskType} onChange={(e) => setFormTaskType(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="autoEmail" checked={formAutoEmail} onChange={(e) => setFormAutoEmail(e.target.checked)} className="rounded" />
                <Label htmlFor="autoEmail" className="cursor-pointer">Auto-send email notification</Label>
              </div>
              <div className="flex justify-end gap-2">
                <DialogClose asChild><Button variant="outline" onClick={resetForm}>Cancel</Button></DialogClose>
                <Button onClick={saveTask} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {editTaskId ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Patient</Label>
              <Select
                options={[{ value: '', label: 'All Patients' }, ...patients.map(p => ({ value: `${p.firstName} ${p.lastName}`, label: `${p.firstName} ${p.lastName}` }))]}
                value={filterPatient}
                onChange={(e) => setFilterPatient(e.target.value)}
              />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Status</Label>
              <Select options={TASK_STATUS_OPTIONS} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Task Type</Label>
              <Select options={[{ value: '', label: 'All Types' }, ...TASK_TYPE_OPTIONS]} value={filterType} onChange={(e) => setFilterType(e.target.value)} />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Therapist</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Email Sent</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.patientName}</TableCell>
                  <TableCell>{t.therapistName}</TableCell>
                  <TableCell>{t.title}</TableCell>
                  <TableCell>
                    <Badge variant={TASK_TYPE_BADGE[t.taskType] || 'secondary'}>
                      {t.taskType}
                    </Badge>
                  </TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  <TableCell className={t.dueDate < todayStr && t.status !== 'COMPLETED' && t.status !== 'CANCELLED' ? 'text-red-600 font-medium' : ''}>
                    {t.dueDate}
                    {t.dueDate < todayStr && t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && (
                      <AlertTriangle className="h-3 w-3 inline ml-1 text-red-500" />
                    )}
                  </TableCell>
                  <TableCell>
                    {t.emailSent ? (
                      <Badge variant="success">Sent</Badge>
                    ) : (
                      <Badge variant="neutral">No</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {t.status === 'PENDING' || t.status === 'SENT' ? (
                        <Button variant="ghost" size="sm" onClick={() => markComplete(t.id)}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
                        </Button>
                      ) : null}
                      {!t.emailSent && t.status !== 'COMPLETED' ? (
                        <Button variant="ghost" size="sm" onClick={() => sendEmail(t.id)}>
                          <Send className="h-3 w-3 mr-1" /> Send Email
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="sm" onClick={() => openEditTask(t.id)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredTasks.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No tasks found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
