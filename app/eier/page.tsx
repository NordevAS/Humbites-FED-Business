import { OwnerDashboard } from '@/features/owner/OwnerDashboard';
export const metadata = {
  title: 'For truckeiere',
  robots: { index: false, follow: false },
};
export default function Page() {
  return <OwnerDashboard />;
}
