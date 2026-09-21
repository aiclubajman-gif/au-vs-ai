import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

type Variant = 'gold' | 'cyan' | 'gray' | 'navy';

const VARIANT_CLASS: Record<Variant, string> = {
  gold: '',
  cyan: 'px-btn--cyan',
  gray: 'px-btn--gray',
  navy: 'px-btn--navy',
};

interface ButtonBase {
  children: ReactNode;
  variant?: Variant;
  whiteText?: boolean;
  className?: string;
  labelClassName?: string;
}

export function PxButton({
  children,
  variant = 'gold',
  whiteText,
  className = '',
  labelClassName = '',
  onClick,
  disabled,
  busy,
  type = 'button',
  ariaLabel,
}: ButtonBase & {
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  type?: 'button' | 'submit';
  ariaLabel?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy}
      aria-label={ariaLabel}
      className={`px-btn ${VARIANT_CLASS[variant]} ${whiteText ? 'px-btn--white-text' : ''} ${className}`}
    >
      <span className="px-btn__face" aria-hidden="true" />
      <span className={`px-btn__label ${labelClassName}`}>{busy ? 'WORKING…' : children}</span>
    </button>
  );
}

export function PxLink({
  children,
  href,
  variant = 'gold',
  whiteText,
  className = '',
  labelClassName = '',
}: ButtonBase & { href: string }) {
  return (
    <Link
      href={href}
      className={`px-btn ${VARIANT_CLASS[variant]} ${whiteText ? 'px-btn--white-text' : ''} ${className}`}
    >
      <span className="px-btn__face" aria-hidden="true" />
      <span className={`px-btn__label ${labelClassName}`}>{children}</span>
    </Link>
  );
}

export function PxPanel({
  children,
  tone = 'gold',
  className = '',
  style,
}: {
  children: ReactNode;
  tone?: 'gold' | 'cyan' | 'gray' | 'gold-fill' | 'cyan-fill';
  className?: string;
  style?: CSSProperties;
}) {
  const tones = {
    gold: '',
    cyan: 'px-panel--cyan',
    gray: 'px-panel--gray',
    'gold-fill': 'px-panel--gold-fill',
    'cyan-fill': 'px-panel--cyan-fill',
  };
  return (
    <div className={`px-panel ${tones[tone]} ${className}`} style={style}>
      {children}
    </div>
  );
}

export function PxChip({
  children,
  tone = 'blue',
  className = '',
}: {
  children: ReactNode;
  tone?: 'blue' | 'gold';
  className?: string;
}) {
  return (
    <span className={`px-chip ${tone === 'gold' ? 'px-chip--gold' : ''} ${className}`}>{children}</span>
  );
}

export function PxTimer({
  progress,
  low,
  className = '',
}: {
  progress: number;
  low?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <div
      className={`px-timer ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div className={`px-timer__fill ${low ? 'px-timer__fill--low' : ''}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

const WORDMARKS = {
  'humans-vs-ai': { alt: 'Humans vs AI', w: 1200, h: 206 },
  'real-or-ai': { alt: 'Real or AI?', w: 1200, h: 190 },
  'draw-vs-ai': { alt: 'Draw vs AI', w: 1200, h: 188 },
  'ai-knowledge': { alt: 'AI Knowledge', w: 1200, h: 179 },
  'human-win': { alt: 'Human win', w: 1200, h: 226 },
  'human-win-stacked': { alt: 'Human win', w: 895, h: 522 },
  'ai-win': { alt: 'AI win', w: 1200, h: 340 },
} as const;

export type WordmarkName = keyof typeof WORDMARKS;

export function Wordmark({
  name,
  as: Tag = 'h1',
  className = '',
  priority,
}: {
  name: WordmarkName;
  as?: 'h1' | 'h2' | 'div';
  className?: string;
  priority?: boolean;
}) {
  const wm = WORDMARKS[name];
  return (
    <Tag className={`relative ${className}`}>
      <span className="sr-only">{wm.alt}</span>
      <img
        src={`/art/wordmarks/${name}.webp`}
        alt=""
        width={wm.w}
        height={wm.h}
        draggable={false}
        fetchPriority={priority ? 'high' : undefined}
        className="pixelated block h-auto w-full select-none"
      />
    </Tag>
  );
}

export function PxStar({ className = '', color = '#ffe66a' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 7 7" className={`inline-block ${className}`} aria-hidden="true" shapeRendering="crispEdges">
      <path
        fill={color}
        d="M3 0h1v2h2v1h-2v1h1v1h-1v2h-1v-2h-1v-1h1v-1h-2v-1h2z"
      />
      <path fill="#7a4a00" d="M3 0h1v1h-1zM0 3h1v1h-1zM6 3h1v1h-1zM3 6h1v1h-1z" opacity=".6" />
    </svg>
  );
}

export function Sprite({
  src,
  alt = '',
  className = '',
  style,
}: {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={`pixelated select-none ${className}`}
      style={style}
      aria-hidden={alt ? undefined : true}
    />
  );
}

export function Scene({
  children,
  left,
  right,
  leftWidth = '22vw',
  rightWidth = '22vw',
  className = '',
}: {
  children: ReactNode;
  left?: string;
  right?: string;
  leftWidth?: string;
  rightWidth?: string;
  className?: string;
}) {
  return (
    <main className={`px-scene flex flex-col ${className}`}>
      {left && (
        <div
          className="px-flank px-flank--left"
          style={{ width: leftWidth, backgroundImage: `url(${left})` }}
          aria-hidden="true"
        />
      )}
      {right && (
        <div
          className="px-flank px-flank--right"
          style={{ width: rightWidth, backgroundImage: `url(${right})` }}
          aria-hidden="true"
        />
      )}
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
    </main>
  );
}

export function ErrorBanner({ message, refCode }: { message: string; refCode?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="mt-4 bg-[#3a0a12] px-4 py-3 shadow-[inset_0_0_0_3px_#ff4d5e]">
      <p className="font-px text-[10px] leading-relaxed text-[#ffb3ba]">{message}</p>
      {refCode && <p className="mt-1 font-px text-[8px] text-[#ff8a96]">{refCode}</p>}
    </div>
  );
}

export function RetryNotice({
  message,
  refCode,
  retryable,
  onRetry,
  busy,
}: {
  message: string;
  refCode?: string;
  retryable: boolean;
  onRetry: () => void;
  busy?: boolean;
}) {
  return (
    <div>
      <ErrorBanner message={message} refCode={refCode} />
      <div className="mt-3">
        <PxButton
          variant="gray"
          busy={busy}
          className="min-h-[56px] w-full text-[11px]"
          onClick={retryable ? onRetry : () => window.location.reload()}
        >
          {retryable ? 'TRY AGAIN' : 'RELOAD'}
        </PxButton>
      </div>
    </div>
  );
}
