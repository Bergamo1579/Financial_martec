import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/server-api';

export default async function ProtectedDashboardPage() {
  const user = await requireUser();
  redirect(user.defaultPath);
}
