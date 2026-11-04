import { DemoCheckout } from '@/features/booking/DemoCheckout';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <DemoCheckout id={(await params).id} />;
}
