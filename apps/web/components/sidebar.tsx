'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoutButton } from './logout-button';

const items = [
  {
    href: '/' as const,
    label: 'Visão técnica',
  },
  {
    href: '/empresas' as const,
    label: 'Empresas',
  },
  {
    href: '/alunos' as const,
    label: 'Alunos',
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="shell-sidebar">
      <div className="brand-block">
        <span className="brand-kicker">Financial Martec</span>
        <h1 className="shell-title">Backoffice financeiro com leitura segura do pedagógico.</h1>
        <p className="shell-copy">
          Base operacional para autenticação, auditoria, sincronização e consulta.
        </p>
      </div>

      <nav className="nav-list">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="nav-item"
            data-active={pathname === item.href}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <LogoutButton />
    </aside>
  );
}
