import { redirect } from 'next/navigation';

export default function Home() {
  const businessId =
    process.env.NEXT_PUBLIC_BUSINESS_ID || '00000000-0000-0000-0000-000000000001';
  redirect(`/dashboard?businessId=${encodeURIComponent(businessId)}`);
}
