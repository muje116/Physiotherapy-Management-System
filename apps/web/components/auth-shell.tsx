import type { ReactNode } from 'react';
import Link from 'next/link';
import { Activity, ArrowUpRight, Check, Clock3, HeartPulse, ShieldCheck } from 'lucide-react';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  icon?: ReactNode;
}

export function AuthShell({ eyebrow, title, description, children, footer, icon }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[#f3f7f2] p-0 text-[#173d34] sm:p-5 lg:p-8">
      <div className="mx-auto grid min-h-screen max-w-[1440px] overflow-hidden bg-white shadow-[0_30px_90px_-45px_rgba(27,76,53,0.28)] sm:min-h-[calc(100vh-2.5rem)] sm:rounded-[2rem] lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.03fr_0.97fr]">
        <section className="relative hidden min-h-[720px] flex-col justify-between overflow-hidden bg-[#1d624b] p-10 text-white lg:flex xl:p-14">
          <div className="absolute -right-36 -top-32 h-[440px] w-[440px] rounded-full border border-white/10" />
          <div className="absolute -right-12 top-16 h-[300px] w-[300px] rounded-full border border-white/10" />
          <div className="absolute -bottom-48 -left-28 h-[520px] w-[520px] rounded-full bg-[#3b8961]/25 blur-3xl" />

          <Link href="/" className="relative z-10 inline-flex w-fit items-center gap-3" aria-label="PhysioCore home">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <HeartPulse className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-tight">PhysioCore</span>
          </Link>

          <div className="relative z-10 my-10 max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#b8dec5]">Care, with more clarity</p>
            <h2 className="mt-5 text-5xl font-semibold leading-[1.04] tracking-[-0.06em] xl:text-6xl">
              Make room
              <br />
              for <span className="font-serif font-medium italic text-[#c2e5c9]">better care.</span>
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-[#d0e3d6]">
              Your practice, your people, and every next step in recovery — thoughtfully together.
            </p>

            <div className="relative mt-11 max-w-[430px] rounded-[1.75rem] border border-white/15 bg-white/[0.09] p-5 shadow-2xl shadow-[#123d2e]/20 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b7d8c2]">Your care team, in sync</p>
                  <p className="mt-1.5 text-lg font-semibold tracking-tight">A smoother kind of busy.</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-[#c2e5c9]">
                  <Activity className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-5 space-y-2.5">
                <div className="flex items-center gap-3 rounded-2xl bg-[#114a36]/35 p-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-[#c2e5c9]"><Clock3 className="h-4 w-4" /></span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Your day, at a glance</p>
                    <p className="mt-0.5 text-xs text-[#c2dbca]">Appointments and reminders together</p>
                  </div>
                  <Check className="h-4 w-4 text-[#b9e2c4]" />
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-[#114a36]/35 p-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-[#c2e5c9]"><ShieldCheck className="h-4 w-4" /></span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Every detail, cared for</p>
                    <p className="mt-0.5 text-xs text-[#c2dbca]">Patient journeys stay in view</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-[#b9e2c4]" />
                </div>
              </div>
            </div>
          </div>

          <p className="relative z-10 text-xs text-[#c2dbca]">Thoughtful tools for people who help people move.</p>
        </section>

        <section className="flex min-h-screen flex-col px-6 py-7 sm:px-10 lg:min-h-0 lg:justify-center lg:px-12 xl:px-20">
          <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col justify-center py-8 lg:flex-none">
            <div className="mb-9 flex items-center justify-between">
              <Link href="/" className="inline-flex items-center gap-2.5 lg:hidden" aria-label="PhysioCore home">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1d624b] text-white">
                  <HeartPulse className="h-4 w-4" />
                </span>
                <span className="font-bold tracking-tight text-[#173d34]">PhysioCore</span>
              </Link>
              <Link href="/" className="ml-auto text-sm font-medium text-[#71887e] transition hover:text-[#1d624b]">
                Back to home
              </Link>
            </div>

            <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf4ec] text-[#347754]">
              {icon ?? <HeartPulse className="h-5 w-5" />}
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5b9274]">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-[#173d34] sm:text-[2.15rem]">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-[#74877f]">{description}</p>

            <div className="mt-8">{children}</div>
            {footer && <div className="mt-6 border-t border-[#edf1ed] pt-5">{footer}</div>}
          </div>
          <p className="mx-auto w-full max-w-[430px] pb-2 text-center text-xs text-[#9aa9a2]">
            Secure access to your practice workspace
          </p>
        </section>
      </div>
    </main>
  );
}
