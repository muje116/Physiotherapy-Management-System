'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save } from 'lucide-react';
import api from '@/lib/api';

interface ClinicSettings {
  name: string;
  practiceNo: string;
  vatNumber: string;
  timezone: string;
  currency: string;
  email: string;
  address: string;
}

interface WorkingHour {
  start: string;
  end: string;
  active: boolean;
}

interface IntegrationState {
  sms: { enabled: boolean };
  email: { enabled: boolean };
  medicalAid: { enabled: boolean };
  xero: { enabled: boolean };
}

const DAYS = [
  { key: 'monday', value: 1, label: 'Monday' },
  { key: 'tuesday', value: 2, label: 'Tuesday' },
  { key: 'wednesday', value: 3, label: 'Wednesday' },
  { key: 'thursday', value: 4, label: 'Thursday' },
  { key: 'friday', value: 5, label: 'Friday' },
  { key: 'saturday', value: 6, label: 'Saturday' },
  { key: 'sunday', value: 0, label: 'Sunday' },
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [clinic, setClinic] = useState<ClinicSettings>({
    name: '',
    practiceNo: '',
    vatNumber: '',
    timezone: 'Africa/Johannesburg',
    currency: 'ZAR',
    email: '',
    address: '',
  });
  const [workingHours, setWorkingHours] = useState<Record<string, WorkingHour>>({});
  const [integrations, setIntegrations] = useState<IntegrationState>({
    sms: { enabled: false },
    email: { enabled: false },
    medicalAid: { enabled: false },
    xero: { enabled: false },
  });

  useEffect(() => {
    Promise.all([
      api.get('/settings/tenant'),
      api.get('/settings'),
      api.get('/settings/integrations'),
    ])
      .then(([tenantRes, settingsRes, integrationsRes]) => {
        const tenant = tenantRes.data.data;
        const settings = settingsRes.data.data;

        setClinic({
          name: tenant.name || '',
          practiceNo: tenant.practiceNumber || '',
          vatNumber: tenant.vatNumber || '',
          timezone: tenant.timezone || 'Africa/Johannesburg',
          currency: tenant.currency || 'ZAR',
          email: '',
          address: '',
        });

        const nextHours = DAYS.reduce<Record<string, WorkingHour>>((acc, day) => {
          acc[day.key] = {
            start: settings.workingHoursStart || '08:00',
            end: settings.workingHoursEnd || '17:00',
            active: (settings.workingDays || []).includes(day.value),
          };
          return acc;
        }, {});

        setWorkingHours(nextHours);
        setIntegrations(integrationsRes.data.data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const saveClinic = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.patch('/settings/tenant', {
        name: clinic.name,
        practiceNumber: clinic.practiceNo,
        vatNumber: clinic.vatNumber,
        timezone: clinic.timezone,
        currency: clinic.currency,
      });
      setSuccess('Clinic details saved successfully');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveHours = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const activeDays = DAYS.filter((day) => workingHours[day.key]?.active).map((day) => day.value);
      const firstActive = DAYS.find((day) => workingHours[day.key]?.active);
      const defaultStart = firstActive ? workingHours[firstActive.key].start : '08:00';
      const defaultEnd = firstActive ? workingHours[firstActive.key].end : '17:00';

      await api.patch('/settings', {
        workingHoursStart: defaultStart,
        workingHoursEnd: defaultEnd,
        workingDays: activeDays,
      });
      setSuccess('Working hours saved successfully');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveIntegration = async (key: keyof IntegrationState, enabled: boolean) => {
    setError(null);
    setSuccess(null);
    try {
      await api.patch(`/settings/integrations/${key}`, { enabled });
      setIntegrations((prev) => ({ ...prev, [key]: { enabled } }));
      setSuccess('Integrations saved successfully');
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your practice configuration</p>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {success && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">{success}</div>}

      <Tabs defaultValue="clinic">
        <TabsList>
          <TabsTrigger value="clinic">Clinic Details</TabsTrigger>
          <TabsTrigger value="hours">Working Hours</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="clinic">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clinic Information</CardTitle>
              <CardDescription>Update your practice details and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Clinic Name" value={clinic.name} onChange={(value) => setClinic({ ...clinic, name: value })} />
                <Field label="Practice Number" value={clinic.practiceNo} onChange={(value) => setClinic({ ...clinic, practiceNo: value })} />
                <Field label="VAT Number" value={clinic.vatNumber} onChange={(value) => setClinic({ ...clinic, vatNumber: value })} />
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select
                    options={[
                      { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (SAST)' },
                      { value: 'Africa/Blantyre', label: 'Africa/Blantyre (CAT)' },
                      { value: 'Europe/London', label: 'Europe/London (GMT)' },
                    ]}
                    value={clinic.timezone}
                    onChange={(e) => setClinic({ ...clinic, timezone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select
                    options={[
                      { value: 'ZAR', label: 'ZAR (R)' },
                      { value: 'USD', label: 'USD ($)' },
                      { value: 'EUR', label: 'EUR (EUR)' },
                      { value: 'GBP', label: 'GBP (GBP)' },
                    ]}
                    value={clinic.currency}
                    onChange={(e) => setClinic({ ...clinic, currency: e.target.value })}
                  />
                </div>
                <Field label="Clinic Email" type="email" value={clinic.email} onChange={(value) => setClinic({ ...clinic, email: value })} />
              </div>
              <Field label="Address" value={clinic.address} onChange={(value) => setClinic({ ...clinic, address: value })} />
              <Separator />
              <div className="flex justify-end">
                <Button onClick={saveClinic} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Working Hours</CardTitle>
              <CardDescription>Set your clinic&apos;s operating hours for each day of the week</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {DAYS.map((day) => {
                const hours = workingHours[day.key];
                if (!hours) return null;

                return (
                  <div key={day.key} className="flex items-center gap-4">
                    <div className="w-28">
                      <Label>{day.label}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={hours.start}
                        className="w-28"
                        disabled={!hours.active}
                        onChange={(e) => setWorkingHours({ ...workingHours, [day.key]: { ...hours, start: e.target.value } })}
                      />
                      <span className="text-muted-foreground">to</span>
                      <Input
                        type="time"
                        value={hours.end}
                        className="w-28"
                        disabled={!hours.active}
                        onChange={(e) => setWorkingHours({ ...workingHours, [day.key]: { ...hours, end: e.target.value } })}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={hours.active}
                        className="rounded"
                        onChange={(e) => setWorkingHours({ ...workingHours, [day.key]: { ...hours, active: e.target.checked } })}
                      />
                      Open
                    </label>
                  </div>
                );
              })}
              <Separator />
              <div className="flex justify-end">
                <Button onClick={saveHours} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Hours
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Integrations</CardTitle>
              <CardDescription>Connect your practice with third-party services</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <IntegrationRow label="SMS" desc="Send appointment reminders via SMS" checked={integrations.sms.enabled} onCheckedChange={(checked) => saveIntegration('sms', checked)} />
              <Separator />
              <IntegrationRow label="Email" desc="Send transactional email updates" checked={integrations.email.enabled} onCheckedChange={(checked) => saveIntegration('email', checked)} />
              <Separator />
              <IntegrationRow label="Medical Aid Switch" desc="Submit medical aid claims electronically" checked={integrations.medicalAid.enabled} onCheckedChange={(checked) => saveIntegration('medicalAid', checked)} />
              <Separator />
              <IntegrationRow label="Xero Accounting" desc="Sync invoices and payments with Xero" checked={integrations.xero.enabled} onCheckedChange={(checked) => saveIntegration('xero', checked)} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function IntegrationRow({ label, desc, checked, onCheckedChange }: { label: string; desc: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
