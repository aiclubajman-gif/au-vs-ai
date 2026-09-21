import type { Metadata, Viewport } from 'next';
import { Press_Start_2P, Pixelify_Sans } from 'next/font/google';
import './globals.css';

const pressStart = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-px',
  display: 'swap',
});

const pixelify = Pixelify_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Humans vs AI — The 60 Second Challenge',
  description:
    'The AIDA Club challenge at the Ajman University Club Fair. Three rounds, one score, one attempt.',
  robots: { index: false },
};

export const viewport: Viewport = {
  themeColor: '#01174d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${pressStart.variable} ${pixelify.variable}`}>
      <body>{children}</body>
    </html>
  );
}
