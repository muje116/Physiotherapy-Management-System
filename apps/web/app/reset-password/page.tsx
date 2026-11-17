'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import { AuthShell } from '@/components/auth-shell';

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
      <AuthShell
        eyebrow="All set"
        title="You’re ready to move forward."
        description="Your password has been reset. You can now securely sign in to your practice."
        icon={<CheckCircle2 className="h-5 w-5" />}
      >
        <div className="rounded-2xl border border-[#dcebdd] bg-[#f5faf5] p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e5f2e7] text-[#418262]">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#315848]">Password updated</p>
              <p className="mt-1 text-sm leading-6 text-[#74877f]">Your account is secure and ready to use.</p>
            </div>
          </div>
        </div>
        <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#438262] transition hover:text-[#1d624b]">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Secure your account"
      title="Choose a new password."
      description="Use at least 8 characters, then sign in again."
      icon={<KeyRound className="h-5 w-5" />}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-semibold text-[#315848]">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            disabled={loading}
            className="h-12 rounded-xl border-[#dbe5dc] bg-[#fbfcfa] px-4 focus-visible:ring-[#4a956a]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmation" className="text-sm font-semibold text-[#315848]">Confirm new password</Label>
          <Input
            id="confirmation"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
            minLength={8}
            disabled={loading}
            className="h-12 rounded-xl border-[#dbe5dc] bg-[#fbfcfa] px-4 focus-visible:ring-[#4a956a]"
          />
        </div>
        <p className="flex items-center gap-2 text-xs text-[#7b8e85]">
          <ShieldCheck className="h-4 w-4 text-[#58906c]" /> Use at least 8 characters for a strong password.
        </p>
        <Button
          className="h-12 w-full rounded-xl bg-[#1d624b] text-white shadow-lg shadow-[#1d624b]/15 transition hover:bg-[#174f3d]"
          type="submit"
          disabled={loading}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {loading ? 'Updating...' : <>Update password <ArrowRight className="ml-2 h-4 w-4" /></>}
        </Button>
      </form>
      <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#438262] transition hover:text-[#1d624b]">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
    </AuthShell>
  );
}
