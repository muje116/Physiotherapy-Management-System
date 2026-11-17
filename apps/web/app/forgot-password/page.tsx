'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, MailCheck } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { AuthShell } from '@/components/auth-shell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthShell
        eyebrow="Check your inbox"
        title="A fresh start is on its way."
        description={`If an account exists for ${email}, you will receive a password reset link shortly.`}
        icon={<CheckCircle2 className="h-5 w-5" />}
      >
        <div className="rounded-2xl border border-[#dcebdd] bg-[#f5faf5] p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e5f2e7] text-[#418262]">
              <MailCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#315848]">Check your email</p>
              <p className="mt-1 text-sm leading-6 text-[#74877f]">Follow the secure link in your inbox to choose a new password.</p>
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
      eyebrow="Password recovery"
      title="Let’s get you back in."
      description="Enter the email address linked to your practice and we’ll send a secure reset link."
      icon={<MailCheck className="h-5 w-5" />}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-semibold text-[#315848]">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@practice.co.za"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="h-12 rounded-xl border-[#dbe5dc] bg-[#fbfcfa] px-4 focus-visible:ring-[#4a956a]"
          />
        </div>
        <Button
          className="h-12 w-full rounded-xl bg-[#1d624b] text-white shadow-lg shadow-[#1d624b]/15 transition hover:bg-[#174f3d]"
          type="submit"
          disabled={loading}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? 'Sending...' : <>Send reset link <ArrowRight className="ml-2 h-4 w-4" /></>}
        </Button>
      </form>
      <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#438262] transition hover:text-[#1d624b]">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
    </AuthShell>
  );
}
