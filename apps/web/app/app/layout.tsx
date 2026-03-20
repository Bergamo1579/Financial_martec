import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { WorkspaceSidebar } from '@/components/workspace-sidebar';
import { requireBootstrap } from '@/lib/server-api';

export default async function AppAreaLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const { user, navigation } = await requireBootstrap();

  if (user.mustChangePassword) {
    redirect('/change-password');
  }

  if (!user.areas.includes('APP')) {
    redirect('/forbidden');
  }

  const items = navigation.items.filter((item) => item.area === 'APP');

  return (
    <div className="shell-grid">
      <WorkspaceSidebar
        area="APP"
        title="Area comum"
        copy="Cadastros, matriculas, empresas e planos conforme o perfil liberado."
        userName={user.name}
        userEmail={user.email}
        items={items}
      />
      <main className="shell-main">{children}</main>
    </div>
  );
}
