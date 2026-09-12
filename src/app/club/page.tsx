import Link from 'next/link';
import { CLUB } from '@/lib/club';

export const metadata = {
  title: 'Join AIDA — AI & Data Science Club',
  description: 'About the AI & Data Science Club at Ajman University, and how to join.',
};

export default function ClubPage() {
  return (
    <main className="min-h-dvh px-6 py-10">
      <div className="mx-auto w-full max-w-md">
        <p className="text-xs tracking-[0.3em] text-[var(--color-cyan-dim)]">
          {CLUB.university.toUpperCase()}
        </p>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight">
          {CLUB.name}
        </h1>

        <div className="mt-6 space-y-4">
          {CLUB.about.map((para) => (
            <p key={para} className="text-sm leading-relaxed text-[var(--color-muted)]">
              {para}
            </p>
          ))}
        </div>

        {/* ---- How to join ---- */}
        <section className="mt-10 rounded-2xl border border-[var(--color-cyan-dim)] bg-[var(--color-navy)] p-5">
          <h2 className="text-lg font-semibold">How to join</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Club membership goes through the university&apos;s ORS system.
          </p>

          <ol className="mt-5 space-y-4">
            {CLUB.ors.steps.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="tabular mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-cyan)] text-xs font-bold text-[var(--color-void)]">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>

          <a
            href={CLUB.ors.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 block w-full rounded-xl bg-[var(--color-cyan)] px-6 py-4 text-center font-semibold text-[var(--color-void)]"
          >
            Open ORS
          </a>
        </section>

        {/* ---- Socials ---- */}
        <section className="mt-10">
          <h2 className="text-sm font-semibold tracking-wider text-[var(--color-muted)]">
            FOLLOW US
          </h2>
          <div className="mt-3 space-y-2">
            {CLUB.socials.map((s) => (
              <a
                key={s.label}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-[var(--color-edge)] bg-[var(--color-navy)] px-4 py-4 transition-colors hover:border-[var(--color-cyan-dim)]"
              >
                <span className="text-sm font-medium">{s.label}</span>
                <span className="text-sm text-[var(--color-cyan)]">{s.handle}</span>
              </a>
            ))}
            <a
              href={`mailto:${CLUB.email}`}
              className="flex items-center justify-between rounded-xl border border-[var(--color-edge)] bg-[var(--color-navy)] px-4 py-4 transition-colors hover:border-[var(--color-cyan-dim)]"
            >
              <span className="text-sm font-medium">Email</span>
              <span className="text-sm text-[var(--color-cyan)]">{CLUB.email}</span>
            </a>
          </div>
        </section>

        <Link
          href="/"
          className="mt-10 block text-center text-sm text-[var(--color-cyan)] underline underline-offset-4"
        >
          Back
        </Link>
      </div>
    </main>
  );
}
