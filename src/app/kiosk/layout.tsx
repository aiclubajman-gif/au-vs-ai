import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import './kiosk.css';

const bricolage = Bricolage_Grotesque({
  weight: ['600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const figtree = Figtree({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-ui',
  display: 'swap',
});

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return <div className={`kiosk ${bricolage.variable} ${figtree.variable}`}>{children}</div>;
}
