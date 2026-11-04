import { TruckRoute } from '@/features/foodtruck/TruckRoute';
export const metadata = { title: 'Foodtruck og meny' };
export default async function Page({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const { slug } = await params;
  return <TruckRoute slug={slug} />;
}
