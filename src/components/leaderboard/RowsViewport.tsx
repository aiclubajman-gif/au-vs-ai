'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * The leaderboard's rows band. Where a phone is too short for the whole board
 * its stylesheet makes this the one part of the page that scrolls (see
 * LeaderboardScreen.module.css). `data-scrolled` and `data-more` mark that
 * rows are hidden above or below, for the fades over its edges. Everywhere else
 * it is a plain box that never scrolls.
 */
export function RowsViewport({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ scrollable: false, scrolled: false, more: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const range = el.scrollHeight - el.clientHeight;
      const scrollable = getComputedStyle(el).overflowY !== 'visible' && range > 1;
      const scrolled = scrollable && el.scrollTop > 0;
      // Rows remain below while the last one's text is not wholly in view, not
      // merely while the band can still move: on a screen only just too short,
      // that is a few pixels of empty panel.
      const bottom = el.getBoundingClientRect().bottom + 0.5;
      const lastRow = el.querySelector('li:last-of-type');
      const more =
        scrollable && !!lastRow && [...lastRow.children].some((c) => c.getBoundingClientRect().bottom > bottom);
      setScroll((s) =>
        s.scrollable === scrollable && s.scrolled === scrolled && s.more === more ? s : { scrollable, scrolled, more },
      );
    };
    update();

    // The band changes size whenever the screen does, including when it
    // switches between the full board and the scrolling one.
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', update);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      data-scrolled={scroll.scrolled ? '' : undefined}
      data-more={scroll.more ? '' : undefined}
      // Reachable by keyboard only while there is something to scroll.
      tabIndex={scroll.scrollable ? 0 : undefined}
      role={scroll.scrollable ? 'region' : undefined}
      aria-label={scroll.scrollable ? 'Leaderboard rows' : undefined}
    >
      {children}
    </div>
  );
}
