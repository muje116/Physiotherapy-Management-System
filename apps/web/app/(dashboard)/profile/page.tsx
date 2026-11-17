'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import api from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

interface ProfileForm {
  firstName: string;
  lastName: string;
  phone: string;
  jobTitle: string;
  department: string;
  email: string;
  role: string;
}

const emptyProfile: ProfileForm = { firstName: '', lastName: '', phone: '', jobTitle: '', department: '', email: '', role: '' };

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get('/users/me')
      .then(({ data }) => {
        const record = data.data;
        setProfile({
          firstName: record.firstName || '',
          lastName: record.lastName || '',
          phone: record.phone || '',
          jobTitle: record.jobTitle || '',
          department: record.department || '',
          email: record.email || '',
          role: record.role || '',
        });
      })
      .catch((err) => setError(err.message || 'Unable to load your profile'))
      .finally(() => setLoading(false));
  }, []);

  const update = (field: keyof ProfileForm, value: string) => setProfile((current) => ({ ...current, [field]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const { data } = await api.patch('/users/me', {
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone || null,
        jobTitle: profile.jobTitle || null,
        department: profile.department || null,
      });
      const saved = data.data;
      setProfile((current) => ({ ...current, ...saved, phone: saved.phone || '', jobTitle: saved.jobTitle || '', department: saved.department || '' }));
      updateUser({ firstName: saved.firstName, lastName: saved.lastName });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Unable to save your profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-10 w-56" /><Skeleton className="h-80" /></div>;

  const initials = `${profile.firstName[0] || ''}${profile.lastName[0] || ''}` || 'U';
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My profile</h1>
        <p className="text-muted-foreground">Manage the contact details attached to your account.</p>
      </div>

      {error && <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {success && <div role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-700">Profile saved.</div>}

      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar fallback={initials} size="lg" />
          <div>
            <CardTitle className="text-base">Account details</CardTitle>
            <CardDescription>{user?.tenant?.name || 'Your clinic'} · {profile.role.replace(/_/g, ' ')}</CardDescription>
          </div>
          <UserRound className="ml-auto h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" value={profile.firstName} onChange={(value) => update('firstName', value)} />
            <Field label="Last name" value={profile.lastName} onChange={(value) => update('lastName', value)} />
            <Field label="Phone" value={profile.phone} onChange={(value) => update('phone', value)} />
            <Field label="Email" value={profile.email} onChange={(value) => update('email', value)} disabled />
            <Field label="Job title" value={profile.jobTitle} onChange={(value) => update('jobTitle', value)} />
            <Field label="Department" value={profile.department} onChange={(value) => update('department', value)} />
          </div>
          <p className="text-xs text-muted-foreground">To change your sign-in email or password, contact a clinic administrator.</p>
          <div className="flex justify-end">
            <Button onClick={() => void save()} disabled={saving || !profile.firstName.trim() || !profile.lastName.trim()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save profile
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <div className="space-y-2"><Label>{label}</Label><Input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></div>;
}
