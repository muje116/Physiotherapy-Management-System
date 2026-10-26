'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, HeartPulse, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '');
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError('This reset link is missing its token. Request a new link.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Password updated</h2>
            <p className="text-sm text-muted-foreground">Your password has been reset. You can now sign in.</p>
            <Link href="/login" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Back to login
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <HeartPulse className="h-7 w-7 text-white" />
            </div>
          </div>
          <CardTitle className="text-xl">Choose a new password</CardTitle>
          <CardDescription>Use at least 8 characters, then sign in again.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmation">Confirm password</Label>
              <Input id="confirmation" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required disabled={loading} />
            </div>
            <Button className="w-full" size="lg" type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {loading ? 'Updating...' : 'Update password'}
            </Button>
            <div className="text-center">
              <Link href="/login" className="text-xs text-primary hover:underline">Back to login</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
