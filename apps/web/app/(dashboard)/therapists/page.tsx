'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Stethoscope, Users } from 'lucide-react';
import api from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface TherapistCard {
  id: string;
  firstName: string;
  lastName: string;
  reg: string;
  specialties: string[];
  utilisation: number;
  patients: number;
}

export default function TherapistsPage() {
  const [therapists, setTherapists] = useState<TherapistCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRegistrationNo, setFormRegistrationNo] = useState('');
  const [formSpecialties, setFormSpecialties] = useState('');
  const [formBio, setFormBio] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchTherapists = () => {
    setLoading(true);
    setError(null);
    api.get('/therapists')
      .then((res) => {
        const rows = (res.data.data || []).map((therapist: any) => ({
          id: therapist.id,
          firstName: therapist.user?.firstName || '',
          lastName: therapist.user?.lastName || '',
          reg: therapist.registrationNo || 'No registration number',
          specialties: therapist.specialties || [],
          utilisation: therapist.utilisation || 0,
          patients: therapist._count?.patients || 0,
        }));
        setTherapists(rows);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTherapists();
  }, []);

  const resetForm = () => {
    setFormFirstName('');
    setFormLastName('');
    setFormEmail('');
    setFormPassword('');
    setFormRegistrationNo('');
    setFormSpecialties('');
    setFormBio('');
  };

  const createTherapist = async () => {
    setSaving(true);
    setError(null);

    try {
      const userRes = await api.post('/users', {
        email: formEmail,
        password: formPassword,
        firstName: formFirstName,
        lastName: formLastName,
        role: 'THERAPIST',
      });

      await api.post('/therapists', {
        userId: userRes.data.data.id,
        registrationNo: formRegistrationNo || undefined,
        specialties: formSpecialties.split(',').map((item) => item.trim()).filter(Boolean),
        bio: formBio || undefined,
      });

      setDialogOpen(false);
      resetForm();
      fetchTherapists();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-8 w-48" /><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-48" /><Skeleton className="h-48" /><Skeleton className="h-48" /></div></div>;
  }

  if (error && therapists.length === 0) {
    return <div className="p-6 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Therapists</h1>
          <p className="text-muted-foreground">Manage your therapy team</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" /> Add Therapist
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Therapist</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input value={formFirstName} onChange={(e) => setFormFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input value={formLastName} onChange={(e) => setFormLastName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Temporary Password</Label>
                <Input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Registration Number</Label>
                <Input value={formRegistrationNo} onChange={(e) => setFormRegistrationNo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Specialties</Label>
                <Input value={formSpecialties} onChange={(e) => setFormSpecialties(e.target.value)} placeholder="Sports, Neuro, Orthopaedics" />
              </div>
              <div className="space-y-2">
                <Label>Bio</Label>
                <Textarea value={formBio} onChange={(e) => setFormBio(e.target.value)} rows={4} />
              </div>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline" onClick={resetForm}>Cancel</Button>
                </DialogClose>
                <Button onClick={createTherapist} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {therapists.map((therapist) => (
          <Link key={therapist.id} href={`/therapists/${therapist.id}`}>
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar fallback={`${therapist.firstName[0] || 'T'}${therapist.lastName[0] || 'H'}`} size="md" />
                    <div>
                      <CardTitle className="text-base">Dr. {therapist.firstName} {therapist.lastName}</CardTitle>
                      <p className="text-sm text-muted-foreground">{therapist.reg}</p>
                    </div>
                  </div>
                  <Stethoscope className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {therapist.specialties.length > 0 ? therapist.specialties.map((specialty) => (
                    <span key={specialty} className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      {specialty}
                    </span>
                  )) : (
                    <span className="text-xs text-muted-foreground">No specialties listed</span>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Utilisation</span>
                    <span className="font-medium">{therapist.utilisation}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${therapist.utilisation}%` }} />
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{therapist.patients} patients</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {therapists.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">No therapists found</div>
        )}
      </div>
    </div>
  );
}
