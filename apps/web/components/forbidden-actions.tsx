'use client';

import { useState } from 'react';

type ForbiddenActionsProps = {
  targetPath?: string | null;
};

export function ForbiddenActions({ targetPath }: ForbiddenActionsProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);

    if (targetPath) {
      window.location.replace(targetPath);
      return;
    }

    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    window.location.replace('/login');
  }

  return (
    <button className="secondary-button" type="button" onClick={handleClick} disabled={loading}>
      {loading ? 'Aguarde...' : targetPath ? 'Voltar para area permitida' : 'Sair e voltar para login'}
    </button>
  );
}
