'use client';

import { useState } from 'react';

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    window.location.replace('/login');
  }

  return (
    <button className="sidebar-logout" type="button" onClick={handleLogout} disabled={loading}>
      {loading ? 'Saindo…' : 'Encerrar sessão'}
    </button>
  );
}
