'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, Loader2, Bell, Mail, MessageSquare, Phone } from 'lucide-react';
import api from '@/lib/api';

interface Template {
  id: string; name: string; trigger: string; channel: string[]; subject: string; body: string; isActive: boolean;
}

interface Channel {
  id: string; name: string; type: string; hasApiKey: boolean; apiKey: string; fromField: string; accountSid: string; isActive: boolean;
}

interface FollowUp {
  id: string; patientName: string; type: string; status: string; followUpDate: string; notes: string;
}

interface FollowUpStats {
  total: number; pending: number; contacted: number; rescheduled: number; closed: number; reengagementRate: string;
}

const CHANNEL_OPTIONS = [
  { value: 'SMS', label: 'SMS' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
];

const TRIGGER_OPTIONS = [
  { value: 'APPOINTMENT_REMINDER', label: 'Appointment Reminder' },
  { value: 'APPOINTMENT_REMINDER_24H', label: 'Appointment Reminder (24 hours)' },
  { value: 'APPOINTMENT_REMINDER_2H', label: 'Appointment Reminder (2 hours)' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
  { value: 'TASK_ASSIGNED', label: 'Task Assigned' },
  { value: 'EXERCISE_PLAN_SENT', label: 'Exercise Plan Sent' },
  { value: 'NO_SHOW', label: 'No-show Follow-up' },
  { value: 'REENGAGEMENT', label: 'Patient Re-engagement' },
  { value: 'INVOICE_SENT', label: 'Invoice Sent' },
  { value: 'PAYMENT_RECEIVED', label: 'Payment Received' },
  { value: 'CLAIM_UPDATE', label: 'Claim Update' },
];

const FOLLOW_UP_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'RESCHEDULED', label: 'Rescheduled' },
  { value: 'CLOSED', label: 'Closed' },
];

const FOLLOW_UP_TYPE_OPTIONS = [
  { value: 'NO_SHOW', label: 'No Show' },
  { value: 'REENGAGEMENT', label: 'Reengagement' },
];

export default function NotificationsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [followUpStats, setFollowUpStats] = useState<FollowUpStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [templateDialog, setTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formName, setFormName] = useState('');
  const [formTrigger, setFormTrigger] = useState('');
  const [formChannel, setFormChannel] = useState<string[]>([]);
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/notifications/templates'),
      api.get('/notifications/channels'),
      api.get('/notifications/follow-ups'),
      api.get('/notifications/follow-ups/stats'),
    ]).then(([tplRes, chRes, fupRes, statsRes]) => {
      setTemplates((tplRes.data.data || []).map((tpl: any) => ({
        id: tpl.id,
        name: tpl.name,
        trigger: tpl.trigger,
        channel: Array.isArray(tpl.channel) ? tpl.channel : [],
        subject: tpl.subject || '',
        body: tpl.body || '',
        isActive: tpl.isActive,
      })));
      setChannels((chRes.data.data || []).map((channel: any) => ({
        id: channel.id,
        name: channel.type.replace(/_/g, ' '),
        type: channel.type,
        hasApiKey: Boolean(channel.hasApiKey),
        apiKey: '',
        fromField: channel.from || '',
        accountSid: typeof channel.config?.accountSid === 'string' ? channel.config.accountSid : '',
        isActive: channel.isActive,
      })));
      setFollowUps((fupRes.data.data || []).map((followUp: any) => ({
        id: followUp.id,
        patientName: followUp.patient ? `${followUp.patient.firstName} ${followUp.patient.lastName}` : 'Unknown patient',
        type: followUp.type,
        status: followUp.status,
        followUpDate: followUp.followUpDate ? new Date(followUp.followUpDate).toISOString().split('T')[0] : '-',
        notes: followUp.notes || '',
      })));
      setFollowUpStats(statsRes.data.data ? {
        ...statsRes.data.data,
        contacted: statsRes.data.data.contacted || 0,
        reengagementRate: `${statsRes.data.data.reengagementRate}%`,
      } : null);
    }).catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setFormName('');
    setFormTrigger('');
    setFormChannel([]);
    setFormSubject('');
    setFormBody('');
    setEditingTemplate(null);
  };

  const openNewTemplate = () => {
    resetForm();
    setTemplateDialog(true);
  };

  const openEditTemplate = (tpl: Template) => {
    setEditingTemplate(tpl);
    setFormName(tpl.name);
    setFormTrigger(tpl.trigger);
    setFormChannel(tpl.channel || []);
    setFormSubject(tpl.subject || '');
    setFormBody(tpl.body || '');
    setTemplateDialog(true);
  };

  const saveTemplate = async () => {
    setSaving(true);
    try {
      const payload = { name: formName, trigger: formTrigger, channel: formChannel, subject: formSubject, body: formBody, isActive: true };
      if (editingTemplate) {
        await api.patch(`/notifications/templates/${editingTemplate.id}`, payload);
      } else {
        await api.post('/notifications/templates', payload);
      }
      setTemplateDialog(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      await api.delete(`/notifications/templates/${id}`);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleTemplate = async (id: string, isActive: boolean) => {
    try {
      await api.patch(`/notifications/templates/${id}`, { isActive });
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, isActive } : t));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleChannel = async (id: string, isActive: boolean) => {
    try {
      await api.patch(`/notifications/channels/${id}`, { isActive });
      setChannels(prev => prev.map(c => c.id === id ? { ...c, isActive } : c));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveChannel = async (channel: Channel) => {
    try {
      await api.patch(`/notifications/channels/${channel.id}`, {
        ...(channel.apiKey.trim() ? { apiKey: channel.apiKey.trim() } : {}),
        from: channel.fromField.trim() || undefined,
        ...(channel.type.startsWith('TWILIO_') && channel.accountSid.trim()
          ? { config: { accountSid: channel.accountSid.trim() } }
          : {}),
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateFollowUpStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/notifications/follow-ups/${id}`, { status });
      setFollowUps(prev => prev.map(f => f.id === id ? { ...f, status } : f));
      const statsRes = await api.get('/notifications/follow-ups/stats');
      setFollowUpStats(statsRes.data.data || null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">Manage templates, channels, and follow-ups</p>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{templates.length} template(s)</p>
            <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
              <DialogTrigger asChild>
                <Button onClick={openNewTemplate}><Plus className="h-4 w-4 mr-2" /> New Template</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Template'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Appointment Reminder" />
                  </div>
                  <div className="space-y-2">
                    <Label>Trigger</Label>
                    <Select options={TRIGGER_OPTIONS} value={formTrigger} onChange={(e) => setFormTrigger(e.target.value)} placeholder="Select trigger" />
                  </div>
                  <div className="space-y-2">
                    <Label>Channel(s)</Label>
                    <div className="flex gap-4">
                      {CHANNEL_OPTIONS.map(ch => (
                        <label key={ch.value} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={formChannel.includes(ch.value)} onChange={(e) => {
                            if (e.target.checked) setFormChannel([...formChannel, ch.value]);
                            else setFormChannel(formChannel.filter(c => c !== ch.value));
                          }} className="rounded" />
                          {ch.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} placeholder="Subject line (email only)" />
                  </div>
                  <div className="space-y-2">
                    <Label>Body</Label>
                    <Textarea value={formBody} onChange={(e) => setFormBody(e.target.value)} rows={5} placeholder="Use {{patientName}}, {{appointmentDate}}, {{therapistName}} etc." />
                    <p className="text-xs text-muted-foreground">Available variables: {'{{patientName}}'}, {'{{appointmentDate}}'}, {'{{therapistName}}'}, {'{{clinicName}}'}</p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <DialogClose asChild><Button variant="outline" onClick={resetForm}>Cancel</Button></DialogClose>
                    <Button onClick={saveTemplate} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      {editingTemplate ? 'Update' : 'Create'}
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
                    <TableHead>Name</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map(tpl => (
                    <TableRow key={tpl.id}>
                      <TableCell className="font-medium">{tpl.name}</TableCell>
                      <TableCell><Badge variant="outline">{tpl.trigger.replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell>{tpl.channel?.join(', ') || '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{tpl.subject || '-'}</TableCell>
                      <TableCell>
                        <Switch checked={tpl.isActive} onCheckedChange={(checked) => toggleTemplate(tpl.id, checked)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEditTemplate(tpl)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteTemplate(tpl.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {templates.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No templates found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {channels.map(ch => (
              <ChannelCard key={ch.id} channel={ch} onToggle={toggleChannel} onSave={saveChannel} />
            ))}
            {channels.length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-8">No channels configured</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="followups">
          {followUpStats && (
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 mb-4">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{followUpStats.total}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pending</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-yellow-600">{followUpStats.pending}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Contacted</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-purple-600">{followUpStats.contacted}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Rescheduled</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-blue-600">{followUpStats.rescheduled}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Closed</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{followUpStats.closed}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Reengagement Rate</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{followUpStats.reengagementRate}</p></CardContent></Card>
            </div>
          )}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Follow-up Date</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {followUps.map(fu => (
                    <TableRow key={fu.id}>
                      <TableCell className="font-medium">{fu.patientName}</TableCell>
                      <TableCell><Badge variant={fu.type === 'NO_SHOW' ? 'destructive' : 'info'}>{fu.type.replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell>
                        <Select
                          options={FOLLOW_UP_STATUS_OPTIONS}
                          value={fu.status}
                          onChange={(e) => updateFollowUpStatus(fu.id, e.target.value)}
                        />
                      </TableCell>
                      <TableCell>{fu.followUpDate}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{fu.notes || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => updateFollowUpStatus(fu.id, 'CLOSED')}>Close</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {followUps.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No follow-ups found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChannelCard({ channel, onToggle, onSave }: { channel: Channel; onToggle: (id: string, active: boolean) => void; onSave: (ch: Channel) => void }) {
  const [apiKey, setApiKey] = useState('');
  const [fromField, setFromField] = useState(channel.fromField || '');
  const [accountSid, setAccountSid] = useState(channel.accountSid || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ ...channel, apiKey, fromField, accountSid });
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            {channel.type === 'TWILIO_SMS' ? <MessageSquare className="h-4 w-4" /> :
             channel.type === 'TWILIO_WHATSAPP' ? <Phone className="h-4 w-4" /> :
             <Mail className="h-4 w-4" />}
          </div>
          <CardTitle className="text-sm font-medium">{channel.name}</CardTitle>
        </div>
        <Switch checked={channel.isActive} onCheckedChange={(checked) => onToggle(channel.id, checked)} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">API Key</Label>
          <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" placeholder={channel.hasApiKey ? 'Leave blank to keep saved key' : 'Enter API key'} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input value={fromField} onChange={(e) => setFromField(e.target.value)} placeholder="Sender ID / email" />
        </div>
        {channel.type.startsWith('TWILIO_') && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Twilio Account SID</Label>
            <Input value={accountSid} onChange={(e) => setAccountSid(e.target.value)} placeholder="AC..." />
          </div>
        )}
        <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : null}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
