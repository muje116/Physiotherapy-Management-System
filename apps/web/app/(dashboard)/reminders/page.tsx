'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Bell, Loader2, Trash2, Send } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import api from '@/lib/api';

interface ReminderRule {
  id: string;
  name: string;
  type: string;
  timing: string;
  channel: string;
  isActive: boolean;
  template: string;
}

const CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP'] as const;

function mapRule(rule: any): ReminderRule {
  return {
    id: rule.id,
    name: String(rule.trigger || '').replace(/_/g, ' '),
    type: rule.trigger,
    timing: 'Automated',
    channel: Array.isArray(rule.channel) ? rule.channel.join(', ') : rule.channel,
    isActive: rule.isActive,
    template: rule.template,
  };
}

export default function RemindersPage() {
  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [manualSending, setManualSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formTrigger, setFormTrigger] = useState('APPOINTMENT_REMINDER');
  const [formChannels, setFormChannels] = useState('EMAIL');
  const [formTemplate, setFormTemplate] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [manualRecipientFilter, setManualRecipientFilter] = useState('ACTIVE');
  const [manualChannel, setManualChannel] = useState<'EMAIL' | 'SMS' | 'WHATSAPP'>('EMAIL');
  const [manualMessage, setManualMessage] = useState('');

  const fetchRules = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await api.get('/reminders/rules');
      setRules((response.data.data || []).map(mapRule));
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Unable to load reminder rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRules();
  }, []);

  const resetForm = () => {
    setFormTrigger('APPOINTMENT_REMINDER');
    setFormChannels('EMAIL');
    setFormTemplate('');
    setFormIsActive(true);
  };

  const openNewRule = () => {
    resetForm();
    setError(null);
    setDialogOpen(true);
  };

  const saveRule = async () => {
    const channel = formChannels
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter((value): value is (typeof CHANNELS)[number] => CHANNELS.includes(value as (typeof CHANNELS)[number]));

    if (!formTrigger.trim() || !formTemplate.trim() || channel.length === 0) {
      setError('Enter a trigger, message template, and at least one valid channel: EMAIL, SMS, or WHATSAPP.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post('/reminders/rules', {
        trigger: formTrigger.trim().toUpperCase().replace(/\s+/g, '_'),
        channel,
        template: formTemplate.trim(),
        isActive: formIsActive,
      });
      setDialogOpen(false);
      resetForm();
      await fetchRules();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Unable to create reminder rule');
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (id: string, isActive: boolean) => {
    setSuccess(null);
    try {
      await api.patch(`/reminders/rules/${id}`, { isActive });
      setRules(prev => prev.map(r => r.id === id ? { ...r, isActive } : r));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteRule = async (id: string) => {
    if (!window.confirm('Delete this reminder rule?')) return;
    setDeletingId(id);
    setError(null);
    try {
      await api.delete(`/reminders/rules/${id}`);
      setRules((current) => current.filter((rule) => rule.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Unable to delete reminder rule');
    } finally {
      setDeletingId(null);
    }
  };

  const sendManualMessage = async () => {
    if (!manualMessage.trim()) {
      setError('Enter a message before sending.');
      return;
    }

    setManualSending(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await api.post('/reminders/send', {
        recipientFilter: manualRecipientFilter,
        channel: manualChannel,
        message: manualMessage.trim(),
      });
      const result = response.data.data;
      setSuccess(`${result.delivered} message(s) delivered; ${result.failed} failed.`);
      setManualDialogOpen(false);
      setManualMessage('');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Unable to send message');
    } finally {
      setManualSending(false);
    }
  };

  if (loading) return <div className="p-6 space-y-4"><Skeleton /><Skeleton /><Skeleton /></div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reminder Rules</h1>
          <p className="text-muted-foreground">Configure automated notifications</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setError(null); setSuccess(null); setManualDialogOpen(true); }}>
            <Send className="h-4 w-4 mr-2" /> Send message
          </Button>
          <Button onClick={openNewRule}>
            <Plus className="h-4 w-4 mr-2" /> New Rule
          </Button>
        </div>
      </div>

      {success && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">{success}</div>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Reminder Rule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Trigger</Label>
              <Input value={formTrigger} onChange={(event) => setFormTrigger(event.target.value)} placeholder="e.g. APPOINTMENT_REMINDER" />
              <p className="text-xs text-muted-foreground">Use a descriptive trigger name; spaces are stored as underscores.</p>
            </div>
            <div className="space-y-2">
              <Label>Channels</Label>
              <Input value={formChannels} onChange={(event) => setFormChannels(event.target.value)} placeholder="EMAIL, SMS" />
              <p className="text-xs text-muted-foreground">Separate channels with commas. Supported: EMAIL, SMS, WHATSAPP.</p>
            </div>
            <div className="space-y-2">
              <Label>Message template</Label>
              <Textarea value={formTemplate} onChange={(event) => setFormTemplate(event.target.value)} rows={5} placeholder="Hi {{patientName}}, this is a reminder for your appointment on {{appointmentDate}}." />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formIsActive} onChange={(event) => setFormIsActive(event.target.checked)} />
              Enable rule immediately
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={() => void saveRule()} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create rule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Manual Message</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Recipients</Label>
              <Select
                options={[
                  { value: 'ACTIVE', label: 'All active patients' },
                  { value: 'INACTIVE', label: 'Inactive patients' },
                  { value: 'ALL', label: 'All patients' },
                ]}
                value={manualRecipientFilter}
                onChange={(event) => setManualRecipientFilter(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select
                options={[
                  { value: 'EMAIL', label: 'Email' },
                  { value: 'SMS', label: 'SMS' },
                  { value: 'WHATSAPP', label: 'WhatsApp' },
                ]}
                value={manualChannel}
                onChange={(event) => setManualChannel(event.target.value as 'EMAIL' | 'SMS' | 'WHATSAPP')}
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea value={manualMessage} onChange={(event) => setManualMessage(event.target.value)} rows={5} placeholder="Write the message to send" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setManualDialogOpen(false)} disabled={manualSending}>Cancel</Button>
              <Button onClick={() => void sendManualMessage()} disabled={manualSending}>
                {manualSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send message
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{rules.filter(r => r.isActive).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Rules</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{rules.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Channels</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{new Set(rules.map(r => r.channel)).size}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reminder Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Timing</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.type}</TableCell>
                  <TableCell>{r.timing}</TableCell>
                  <TableCell>{r.channel}</TableCell>
                  <TableCell>
                    <Switch checked={r.isActive} onCheckedChange={(checked) => toggleRule(r.id, checked)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void deleteRule(r.id)} disabled={deletingId === r.id}>
                      {deletingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      <span className="sr-only">Delete {r.name}</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No reminder rules configured</TableCell>
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
  return <div className="h-4 bg-muted rounded animate-pulse w-full" />;
}
