import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { WorkspaceSidebar } from '@/components/workspace-sidebar';
import { requireBootstrap } from '@/lib/server-api';

export default async function BackofficeLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const { user, navigation } = await requireBootstrap();

  if (user.mustChangePassword) {
    redirect('/change-password');
  }

  if (!user.areas.includes('BACKOFFICE')) {
    redirect('/forbidden');
  }

  const items = navigation.items.filter((item) => item.area === 'BACKOFFICE');

  return (
    <div className="shell-grid">
      <WorkspaceSidebar
        area="BACKOFFICE"
        title="Backoffice"
        copy="Administração e controle operacional."
        userName={user.name}
        userEmail={user.email}
        items={items}
      />
      <main className="shell-main">{children}</main>
    </div>
  );
}
