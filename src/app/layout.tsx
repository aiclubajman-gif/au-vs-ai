import type { Metadata, Viewport } from 'next';
import './globals.css';

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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
