/** Inline icons for the arena screen: gradient-filled so they glow like the art. */

const TROPHY_TONES = {
  human: ['#e9fbff', '#7fd6ff', '#1f7bff'],
  ai: ['#fff4c0', '#ffc233', '#ff6a12'],
} as const;

export function Trophy({ side, className }: { side: 'human' | 'ai'; className?: string }) {
  const [light, mid, deep] = TROPHY_TONES[side];
  const id = `trophy-${side}`;
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="0.5" stopColor={mid} />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${id})`} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
        <path d="M18 12 H9 C9 22 13 28 21 29" />
        <path d="M46 12 H55 C55 22 51 28 43 29" />
      </g>
      <path
        fill={`url(#${id})`}
        d="M17 7 H47 V22 C47 32 40 39 32 39 C24 39 17 32 17 22 Z M29 39 H35 V47 H29 Z M21 47 H43 V52 H21 Z M17 52 H47 V58 H17 Z"
      />
      <path fill="#ffffff" fillOpacity="0.45" d="M22 11 H27 V23 C27 28 29 31 31 33 C25 32 22 28 22 22 Z" />
    </svg>
  );
}

/** Gold, silver, bronze — for ranks 1, 2 and 3. */
const CROWN_TONES = [
  ['#fff7c2', '#ffd23f', '#e08a00'],
  ['#ffffff', '#d7e2f0', '#8a9bb4'],
  ['#ffe0bf', '#ff9f4a', '#b8520e'],
] as const;

export function Crown({ rank, className }: { rank: number; className?: string }) {
  const [light, mid, deep] = CROWN_TONES[Math.min(Math.max(rank, 1), 3) - 1];
  const id = `crown-${rank}`;
  return (
    <svg className={className} viewBox="0 0 64 52" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="0.55" stopColor={mid} />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
      </defs>
      <path fill={`url(#${id})`} d="M6 40 L9 14 L22 27 L32 8 L42 27 L55 14 L58 40 Z M7 43 H57 V49 H7 Z" />
      <g fill={light}>
        <circle cx="9" cy="12" r="3.5" />
        <circle cx="32" cy="6" r="4" />
        <circle cx="55" cy="12" r="3.5" />
      </g>
      <path fill="#ffffff" fillOpacity="0.4" d="M12 38 L14 22 L22 31 L32 14 L26 38 Z" />
    </svg>
  );
}
