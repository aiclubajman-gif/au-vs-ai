import QRCode from 'qrcode';
import { Kiosk } from '@/components/kiosk/Kiosk';
import { CLUB } from '@/lib/club';

export const metadata = {
  title: 'AIDA · Club Fair Kiosk',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default async function KioskPage() {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://auvsai.com').replace(/\/$/, '');
  const opts = { errorCorrectionLevel: 'M' as const, margin: 1, width: 640, color: { dark: '#1c2b4b', light: '#ffffff' } };
  const [qr, qrWhatsapp] = await Promise.all([QRCode.toDataURL(site, opts), QRCode.toDataURL(CLUB.whatsapp, opts)]);
  return <Kiosk siteUrl={site} qr={qr} qrWhatsapp={qrWhatsapp} />;
}
