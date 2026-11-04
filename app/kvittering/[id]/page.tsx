import { Receipt } from '@/features/booking/Receipt';
export const metadata = {
  title: 'Din forespørsel',
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Receipt id={id} />;
}
