'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from './docs.module.css';

type NavItem = {
  id: string;
  label: string;
  group?: string;
};

export function DocsNav({ items }: { items: NavItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '');

  useEffect(() => {
    const ids = items.map((i) => i.id);
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-10% 0px -60% 0px', threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      e.preventDefault();
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
      window.history.replaceState(null, '', `#${id}`);
    },
    [],
  );

  let lastGroup: string | undefined;

  return (
    <nav className={styles.nav}>
      {items.map((item) => {
        const showGroup = item.group && item.group !== lastGroup;
        if (item.group) lastGroup = item.group;

        return (
          <div key={item.id}>
            {showGroup && <p className={styles.navGroup}>{item.group}</p>}
            <a
              href={`#${item.id}`}
              onClick={(e) => handleClick(e, item.id)}
              className={`${styles.navLink} ${activeId === item.id ? styles.navLinkActive : ''}`}
            >
              {item.label}
            </a>
          </div>
        );
      })}
    </nav>
  );
}
