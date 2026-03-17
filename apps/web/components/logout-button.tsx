'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    router.push('/login');
    router.refresh();
  }

  return (
    <button className="secondary-button" type="button" onClick={handleLogout} disabled={loading}>
      {loading ? 'Saindo...' : 'Encerrar sessão'}
    </button>
  );
}
