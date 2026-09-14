import type { Metadata, Viewport } from 'next';
import { Press_Start_2P, Silkscreen } from 'next/font/google';
import './globals.css';

const pressStart2P = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-pixel',
  display: 'swap',
});

const silkscreen = Silkscreen({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-silkscreen',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AU vs AI — Can You Beat AI in 60 Seconds?',
  description:
    'The AIDA Club challenge at the Ajman University Club Fair. Three rounds, one score, one attempt.',
  robots: { index: false },
};

export const viewport: Viewport = {
  themeColor: '#05070f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${pressStart2P.variable} ${silkscreen.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
