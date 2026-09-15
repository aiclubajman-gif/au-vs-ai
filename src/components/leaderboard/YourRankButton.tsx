'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { postJson } from '@/lib/client/submit';

/**
 * Your Rank. The public leaderboard knows nothing about the viewer, so this
 * asks the existing result endpoint: a student with a finished game is taken
 * to /play, which shows their final result and rank. Anyone else gets a short
 * explanation instead of being sent to /play, where a signed-in student who
 * has not played would start their one official attempt.
 */
export function YourRankButton({
  className,
  labelClassName,
  statusClassName,
}: {
  className: string;
  labelClassName: string;
  statusClassName: string;
}) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const checking = useRef(false);
  const router = useRouter();

  async function showRank() {
    if (checking.current) return;
    checking.current = true;
    setBusy(true);
    setStatus('');
    try {
      const res = await postJson('/api/attempt/result', {});
      if (res.ok) {
        router.push('/play');
        return;
      }
      if (res.code === 'UNAUTHORIZED' || res.code === 'ATTEMPT_NOT_FOUND') {
        setStatus('Finish your game to get a rank.');
      } else {
        setStatus("Couldn't check your rank. Try again.");
      }
    } finally {
      checking.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={showRank} aria-busy={busy}>
        <span className={labelClassName}>Your rank</span>
      </button>
      <p className={statusClassName} role="status">
        {status}
      </p>
    </>
  );
}
