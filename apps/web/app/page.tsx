import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  UsersRound,
} from 'lucide-react';

const features = [
  {
    icon: CalendarDays,
    title: 'A calmer schedule',
    description: 'Keep appointments, reminders, and your team in sync without the busywork.',
    color: 'bg-[#e6f4ee] text-[#247b59]',
  },
  {
    icon: UsersRound,
    title: 'Care that connects',
    description: 'Bring patient history, treatment plans, and progress together in one place.',
    color: 'bg-[#edf0fc] text-[#5968b5]',
  },
  {
    icon: TrendingUp,
    title: 'A healthier practice',
    description: 'See the numbers that matter and make confident decisions as you grow.',
    color: 'bg-[#fbf0df] text-[#b87928]',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fbfcfa] text-[#173d34]">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="PhysioCore home">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1d624b] text-white shadow-lg shadow-[#1d624b]/15">
            <HeartPulse className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="text-lg font-bold tracking-tight text-[#173d34]">PhysioCore</span>
        </Link>

        <nav className="hidden items-center gap-9 text-sm font-medium text-[#55746b] md:flex" aria-label="Main navigation">
          <Link className="transition hover:text-[#173d34]" href="#platform">Platform</Link>
          <Link className="transition hover:text-[#173d34]" href="#how-it-works">How it works</Link>
          <Link className="transition hover:text-[#173d34]" href="#for-practices">For practices</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden px-3 py-2 text-sm font-semibold text-[#315d50] transition hover:text-[#173d34] sm:inline-flex">
            Sign in
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-[#1d624b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#1d624b]/15 transition hover:-translate-y-0.5 hover:bg-[#174f3d]"
          >
            Get started <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 pb-20 pt-10 lg:grid-cols-[0.95fr_1.05fr] lg:px-10 lg:pb-28 lg:pt-14">
        <div className="absolute -left-40 top-12 -z-0 h-96 w-96 rounded-full bg-[#e6f2e9] blur-3xl" />
        <div className="relative z-10 max-w-xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#dce9df] bg-white/80 px-4 py-2 text-xs font-semibold tracking-wide text-[#397158] shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            A brighter way to run your practice
          </div>
          <h1 className="text-[clamp(3.2rem,7vw,5.6rem)] font-semibold leading-[0.99] tracking-[-0.065em] text-[#173d34]">
            Better care,
            <br />
            <span className="font-serif font-medium italic tracking-[-0.055em] text-[#3d8968]">in motion.</span>
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-8 text-[#607a71]">
            The thoughtful workspace for physiotherapy teams. Spend less time managing the day and more time helping people move forward.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-3 rounded-full bg-[#1d624b] px-7 py-4 text-sm font-semibold text-white shadow-xl shadow-[#1d624b]/20 transition hover:-translate-y-0.5 hover:bg-[#174f3d]"
            >
              Discover PhysioCore <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="#platform" className="inline-flex items-center gap-2 px-3 py-3 text-sm font-semibold text-[#477163] transition hover:text-[#173d34]">
              Take a look <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-[#688178]">
            <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#3d8968]" /> Less admin, more care</span>
            <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#3d8968]" /> Your team, in sync</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[610px] lg:ml-auto">
          <div className="absolute -right-7 top-8 h-24 w-24 rounded-full border border-[#b8d7c2] lg:-right-12" />
          <div className="absolute -bottom-8 left-12 h-32 w-32 rounded-full bg-[#e8d9bc]/60 blur-2xl" />
          <div className="relative min-h-[440px] overflow-hidden rounded-[2rem] bg-[#dcece1] p-5 shadow-[0_35px_80px_-40px_rgba(26,80,59,0.42)] sm:min-h-[500px] sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_25%,rgba(255,255,255,0.78),transparent_38%),linear-gradient(145deg,#dcece1_8%,#c9e2d2_60%,#b4d2c2)]" />
            <div className="absolute -right-20 top-28 h-72 w-72 rounded-full border border-white/40" />
            <div className="absolute -right-8 top-40 h-48 w-48 rounded-full border border-white/50" />

            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#57806c]">Your practice, in rhythm</p>
                <p className="mt-2 text-sm font-medium text-[#285543]">A little more room to focus.</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/75 text-[#3c765a] shadow-sm">
                <Activity className="h-5 w-5" />
              </div>
            </div>

            <div className="absolute right-8 top-[102px] hidden w-[190px] rotate-3 rounded-2xl border border-white/75 bg-white/70 p-4 shadow-xl shadow-[#3e7157]/10 backdrop-blur-md sm:block">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#55746b]">PATIENT PROGRESS</span>
                <TrendingUp className="h-4 w-4 text-[#478564]" />
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-[#214a39]">Feeling better</p>
              <div className="mt-4 flex h-10 items-end gap-1.5">
                {[30, 43, 38, 57, 52, 72, 88, 82, 100].map((height, index) => (
                  <span key={index} className="flex-1 rounded-t-sm bg-[#6eaa82]/70" style={{ height: `${height}%` }} />
                ))}
              </div>
              <p className="mt-2 text-[10px] text-[#748b80]">A clearer picture of every recovery</p>
            </div>

            <div className="absolute bottom-8 left-5 right-5 rounded-3xl border border-white/75 bg-white/85 p-5 shadow-2xl shadow-[#315e47]/15 backdrop-blur-xl sm:bottom-10 sm:left-8 sm:right-auto sm:w-[340px] sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#789087]">TUESDAY · YOUR DAY AT A GLANCE</p>
                  <p className="mt-1 text-xl font-semibold tracking-tight text-[#214a39]">Care, all in one place.</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e9f4ed] text-[#41815f]">
                  <CalendarDays className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-5 space-y-3">
                <div className="flex items-center gap-3 rounded-2xl bg-[#f7faf7] p-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6f1e8] text-[#478564]">
                    <Stethoscope className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#315848]">One-to-one session</p>
                    <p className="mt-0.5 text-xs text-[#81948c]">Treatment room · Follow-up</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-medium text-[#638075]"><Clock3 className="h-3.5 w-3.5" /> 10:30</span>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-[#f7faf7] p-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5efe3] text-[#ad8040]">
                    <Activity className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#315848]">Movement assessment</p>
                    <p className="mt-0.5 text-xs text-[#81948c]">Studio 2 · New patient</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-medium text-[#638075]"><Clock3 className="h-3.5 w-3.5" /> 11:15</span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[#edf1ed] pt-4 text-xs">
                <span className="text-[#82948c]">Everything in step with your team</span>
                <ShieldCheck className="h-4 w-4 text-[#4c8967]" />
              </div>
            </div>

            <div className="absolute bottom-24 right-5 hidden items-center gap-3 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-xl shadow-[#315e47]/10 backdrop-blur-md sm:flex">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8f4eb] text-[#438262]"><Check className="h-4 w-4" /></span>
              <div>
                <p className="text-xs font-semibold text-[#315848]">A smoother day</p>
                <p className="mt-0.5 text-[10px] text-[#82948c]">The small things, taken care of</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="border-y border-[#e9efea] bg-white/70">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5b9274]">Made for the way you care</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#173d34] sm:text-4xl">Your whole practice. Moving together.</h2>
            <p className="mt-4 text-base leading-7 text-[#70867e]">From the first hello to the next milestone, everything your team needs is right where it should be.</p>
          </div>
          <div id="how-it-works" className="mt-12 grid gap-5 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description, color }) => (
              <article key={title} className="group rounded-3xl border border-[#e8eee8] bg-[#fcfdfb] p-7 transition duration-300 hover:-translate-y-1 hover:border-[#cbded0] hover:shadow-xl hover:shadow-[#305b43]/5">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${color}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-6 text-lg font-semibold tracking-tight text-[#214a39]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#748a81]">{description}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#438262] transition group-hover:gap-3">
                  Explore the platform <ArrowRight className="h-4 w-4" />
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="for-practices" className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#1b533f] px-7 py-12 text-center sm:px-12 sm:py-16">
          <div className="absolute -right-20 -top-32 h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute -bottom-48 -left-20 h-96 w-96 rounded-full bg-[#397c59]/30 blur-2xl" />
          <div className="relative mx-auto max-w-2xl">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#c5e5ce]">
              <HeartPulse className="h-6 w-6" />
            </span>
            <h2 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Make more room for what matters.</h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-[#c3d9cd]">Meet the workspace built around better days for your team and better outcomes for your patients.</p>
            <Link href="/login" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#f4f7ed] px-6 py-3.5 text-sm font-semibold text-[#22543f] transition hover:-translate-y-0.5 hover:bg-white">
              Get started with PhysioCore <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-[#e9efea] px-6 py-7 text-xs text-[#82948c] sm:flex-row lg:px-10">
        <Link href="/" className="flex items-center gap-2 font-semibold text-[#426454]">
          <HeartPulse className="h-4 w-4" /> PhysioCore
        </Link>
        <p>Thoughtful tools for people who help people move.</p>
        <Link href="/login" className="font-semibold text-[#4d7864] transition hover:text-[#173d34]">Sign in <span aria-hidden="true">→</span></Link>
      </footer>
    </main>
  );
}
