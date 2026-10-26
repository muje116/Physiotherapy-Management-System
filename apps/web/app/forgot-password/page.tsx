'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HeartPulse, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Check your email</h2>
            <p className="text-sm text-muted-foreground">
              If an account exists for {email}, you will receive a password reset link shortly.
            </p>
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
          <CardTitle className="text-xl">Reset Password</CardTitle>
          <CardDescription>Enter your email and we&apos;ll send you a reset link</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@practice.co.za"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button className="w-full" size="lg" type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
            <div className="text-center">
              <Link href="/login" className="text-xs text-primary hover:underline">
                Back to login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
