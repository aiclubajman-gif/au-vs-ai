import Link from 'next/link';
import Image from 'next/image';
import { CLUB } from '@/lib/club';

export const metadata = {
  title: 'Join AIDA — AI & Data Science Club',
  description: 'About the AI & Data Science Club at Ajman University, and how to join.',
};

export default function ClubPage() {
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#05060f] px-4 py-8 text-white">
      {/* Background Cosmic Atmosphere */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-40">
        <Image
          src="/backgrounds/homepage-clean.png"
          alt="Arena Background"
          fill
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05060f]/80 via-transparent to-[#05060f]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-xl lg:max-w-2xl">
        {/* Top Club Header */}
        <header className="relative mb-6 flex flex-col items-center text-center">
          {/* AIDA Logo title */}
          <div className="flex flex-col items-center">
            <h2 className="font-['Press_Start_2P',monospace] text-2xl font-black tracking-widest text-[#00e5ff] drop-shadow-[0_0_16px_rgba(0,229,255,0.8)] sm:text-3xl">
              AIDA
            </h2>
            <p className="mt-1 font-['Press_Start_2P',monospace] text-[9px] uppercase tracking-[0.3em] text-[#8fa0c0]">
              AI &amp; Data Analytics Club
            </p>
          </div>

          {/* JOIN US Title and Flanking Mascots */}
          <div className="relative my-4 flex w-full items-center justify-center">
            {/* Left Mascot */}
            <div className="relative hidden sm:flex flex-col items-center w-28 shrink-0 animate-bounce" style={{ animationDuration: '4s' }}>
              <div className="mb-1 rounded-lg border border-[#00e5ff]/50 bg-[#080d24]/90 px-2 py-1 text-[9px] font-bold text-[#00e5ff] shadow-[0_0_10px_rgba(0,229,255,0.4)]">
                Join • Build • Belong
              </div>
              <div className="relative h-28 w-28">
                <Image
                  src="/sprites/mascot-boy-cheer.png"
                  alt="AIDA Mascot"
                  fill
                  className="object-contain drop-shadow-[0_0_12px_rgba(0,229,255,0.5)]"
                />
              </div>
            </div>

            {/* Giant Title */}
            <div className="px-4 text-center">
              <h1 className="font-['Press_Start_2P',monospace] text-4xl font-black leading-tight tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-[#ffffff] via-[#00e5ff] to-[#0088ff] drop-shadow-[0_0_25px_rgba(0,229,255,0.9)] sm:text-5xl">
                JOIN<br />US
              </h1>
            </div>

            {/* Right Mascot */}
            <div className="relative hidden sm:flex flex-col items-center w-28 shrink-0 animate-bounce" style={{ animationDuration: '4.5s' }}>
              <div className="mb-1 rounded-lg border border-[#ff9100]/50 bg-[#080d24]/90 px-2 py-1 text-[9px] font-bold text-[#ffb300] shadow-[0_0_10px_rgba(255,145,0,0.4)]">
                Think • Analyze • Build
              </div>
              <div className="relative h-28 w-28">
                <Image
                  src="/sprites/mascot-girl-cheer.png"
                  alt="AIDA Mascot"
                  fill
                  className="object-contain drop-shadow-[0_0_12px_rgba(255,145,0,0.5)]"
                />
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="mt-2 flex w-full flex-col gap-3 sm:px-8">
            {/* Open ORS */}
            <a
              href={CLUB.ors.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 rounded-xl border-2 border-[#00e5ff] bg-gradient-to-r from-[#00b0ff] to-[#0070e0] py-3.5 px-6 font-['Press_Start_2P',monospace] text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(0,229,255,0.6)] transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(0,229,255,0.9)] active:scale-[0.98]"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
              </svg>
              <span>OPEN ORS →</span>
            </a>

            {/* Join WhatsApp Community */}
            <a
              href="https://chat.whatsapp.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 rounded-xl border-2 border-[#ff9100] bg-gradient-to-r from-[#ff6d00] to-[#e65100] py-3.5 px-6 font-['Press_Start_2P',monospace] text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(255,109,0,0.5)] transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(255,109,0,0.8)] active:scale-[0.98]"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm0 18.06c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.12 8.12 0 01-1.25-4.29c0-4.5 3.66-8.16 8.16-8.16 2.18 0 4.23.85 5.77 2.39 1.54 1.54 2.39 3.59 2.39 5.77 0 4.5-3.66 8.16-8.08 8.16z" />
              </svg>
              <span>JOIN WHATSAPP COMMUNITY →</span>
            </a>
          </div>
        </header>

        {/* ORS Registration Process Card */}
        <section className="relative rounded-2xl border-2 border-[#00e5ff]/60 bg-[#080d24]/90 p-5 shadow-[0_0_25px_rgba(0,229,255,0.25)] backdrop-blur-md sm:p-7">
          {/* Card Header */}
          <div className="mb-6 flex items-center gap-3 border-b border-[#00e5ff]/30 pb-4">
            <svg className="h-6 w-6 text-[#00e5ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <h2 className="font-['Press_Start_2P',monospace] text-sm font-bold uppercase tracking-wider text-white sm:text-base">
              ORS REGISTRATION PROCESS
            </h2>
          </div>

          {/* Steps List */}
          <ol className="space-y-4">
            {/* Step 1 */}
            <li className="flex items-start gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#00e5ff] bg-[#00e5ff]/20 font-['Press_Start_2P',monospace] text-xs font-bold text-[#00e5ff]">
                1
              </span>
              <p className="pt-0.5 text-sm text-slate-200">
                Click the <strong className="text-[#00e5ff]">OPEN ORS</strong> button.
              </p>
            </li>

            {/* Step 2 */}
            <li className="flex items-start gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#00e5ff] bg-[#00e5ff]/20 font-['Press_Start_2P',monospace] text-xs font-bold text-[#00e5ff]">
                2
              </span>
              <p className="pt-0.5 text-sm text-slate-200">
                Go to <strong className="text-[#00e5ff]">eRequests → New Request</strong>.
              </p>
            </li>

            {/* Step 3 */}
            <li className="flex items-start gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#00e5ff] bg-[#00e5ff]/20 font-['Press_Start_2P',monospace] text-xs font-bold text-[#00e5ff]">
                3
              </span>
              <p className="pt-0.5 text-sm text-slate-200">
                Request Category: <strong className="text-[#00e5ff]">Student Life</strong>.
              </p>
            </li>

            {/* Step 4 */}
            <li className="flex items-start gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#00e5ff] bg-[#00e5ff]/20 font-['Press_Start_2P',monospace] text-xs font-bold text-[#00e5ff]">
                4
              </span>
              <div className="pt-0.5 text-sm text-slate-200">
                <p>Request Type:</p>
                <ul className="mt-2 space-y-1.5 pl-2 text-xs">
                  <li className="flex items-center gap-2 text-slate-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00e5ff]" />
                    <span>If you are a male pick <strong className="text-[#00e5ff]">&quot;Male student club membership&quot;</strong></span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00e5ff]" />
                    <span>If you are a female pick <strong className="text-[#00e5ff]">&quot;Female student club membership&quot;</strong></span>
                  </li>
                </ul>
              </div>
            </li>

            {/* Step 5 */}
            <li className="flex items-start gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#00e5ff] bg-[#00e5ff]/20 font-['Press_Start_2P',monospace] text-xs font-bold text-[#00e5ff]">
                5
              </span>
              <p className="pt-0.5 text-sm text-slate-200">
                Select <strong className="text-[#00e5ff]">&quot;Male/Female AI and Data Science Club&quot;</strong> for the Student Clubs (Male/Female).
              </p>
            </li>

            {/* Step 6 */}
            <li className="flex items-start gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#00e5ff] bg-[#00e5ff]/20 font-['Press_Start_2P',monospace] text-xs font-bold text-[#00e5ff]">
                6
              </span>
              <p className="pt-0.5 text-sm text-slate-200">
                Fill out the rest of the info and submit.
              </p>
            </li>
          </ol>
        </section>

        {/* Socials / Follow Us */}
        <section className="mt-8">
          <h3 className="mb-3 font-['Press_Start_2P',monospace] text-[10px] uppercase tracking-wider text-[#8fa0c0]">
            CONNECT WITH AIDA
          </h3>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {CLUB.socials.map((s) => (
              <a
                key={s.label}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-[#1a2b54] bg-[#0c1538]/80 px-4 py-3 text-xs transition-all hover:border-[#00e5ff]/50 hover:bg-[#0c1538]"
              >
                <span className="font-semibold text-slate-200">{s.label}</span>
                <span className="text-[#00e5ff]">{s.handle}</span>
              </a>
            ))}
          </div>
        </section>

        {/* Back Link */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="font-['Press_Start_2P',monospace] text-[10px] text-[#00e5ff] underline underline-offset-4 hover:text-white"
          >
            ← BACK TO HOME
          </Link>
        </div>
      </div>
    </main>
  );
}
