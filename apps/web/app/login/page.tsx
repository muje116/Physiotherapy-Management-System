'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { AuthShell } from '@/components/auth-shell';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      const destination = loggedInUser.role === 'PATIENT'
        ? '/portal'
        : loggedInUser.permissions?.includes('finance:read')
          ? '/dashboard'
          : '/appointments';
      router.replace(destination);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to your practice"
      description="Pick up where you left off and keep great care moving."
      footer={(
        <p className="text-center text-xs leading-5 text-[#8a9b93]">
          By signing in, you agree to the Terms of Service and Privacy Policy.
        </p>
      )}
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-semibold text-[#315848]">Password</Label>
            <Link href="/forgot-password" className="text-xs font-semibold text-[#438262] transition hover:text-[#1d624b]">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {loading ? 'Signing in...' : <>Continue to your practice <ArrowRight className="ml-2 h-4 w-4" /></>}
        </Button>
      </form>
    </AuthShell>
  );
}
