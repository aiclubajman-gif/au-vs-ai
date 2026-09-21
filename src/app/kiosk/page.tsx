import QRCode from 'qrcode';
import { Kiosk } from '@/components/kiosk/Kiosk';

export const metadata = {
  title: 'AIDA · Club Fair Kiosk',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default async function KioskPage() {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://auvsai.com').replace(/\/$/, '');
  const qr = await QRCode.toDataURL(site, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 640,
    color: { dark: '#1c2b4b', light: '#ffffff' },
  });
  return <Kiosk siteUrl={site} qr={qr} />;
}
