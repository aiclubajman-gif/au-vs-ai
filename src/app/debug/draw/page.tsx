import { notFound } from 'next/navigation';
import { DebugDraw } from '@/components/game/DebugDraw';

export const metadata = { title: 'Preprocessing debug', robots: { index: false } };

export default function DebugDrawPage() {
  // Development only. This page runs the competition model on demand and shows
  // live confidences, so in a production build it would let students practise
  // their drawings against the exact model that scores Round 2.
  if (process.env.NODE_ENV === 'production') notFound();

  return <DebugDraw />;
}
