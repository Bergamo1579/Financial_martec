'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavigationItem } from '@financial-martec/contracts';
import { LogoutButton } from './logout-button';

type WorkspaceSidebarProps = {
  area: 'BACKOFFICE' | 'APP';
  title: string;
  copy: string;
  userName: string;
  userEmail: string;
  items: NavigationItem[];
};

export function WorkspaceSidebar({
  area,
  title,
  copy,
  userName,
  userEmail,
  items,
}: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const groupedItems = new Map<string, NavigationItem[]>();

  for (const item of items) {
    if (!groupedItems.has(item.group)) {
      groupedItems.set(item.group, []);
    }

    groupedItems.get(item.group)?.push(item);
  }

  return (
    <aside className="shell-sidebar">
      <div className="brand-block">
        <span className="brand-kicker">
          {area === 'BACKOFFICE' ? 'Financial Martec Backoffice' : 'Financial Martec App'}
        </span>
        <h1 className="shell-title">{title}</h1>
        <p className="shell-copy">{copy}</p>
      </div>

      <div className="sidebar-user">
        <strong>{userName}</strong>
        <span>{userEmail}</span>
      </div>

      <nav className="nav-groups">
        {[...groupedItems.entries()].map(([group, groupItems]) => (
          <div key={group} className="nav-group">
            <span className="nav-group-label">{group}</span>
            <div className="nav-list">
              {groupItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path as never}
                  className="nav-item"
                  data-active={pathname === item.path}
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <LogoutButton />
    </aside>
  );
}
