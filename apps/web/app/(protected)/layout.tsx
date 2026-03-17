import { Sidebar } from '@/components/sidebar';
import { requireUser } from '@/lib/server-api';

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireUser();

  return (
    <div className="shell-grid">
      <Sidebar />
      <main className="shell-main">{children}</main>
    </div>
  );
}
