'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClientFetch } from '@/lib/client-api';

export function ChangePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get('currentPassword') ?? '');
    const newPassword = String(formData.get('newPassword') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');

    if (newPassword !== confirmPassword) {
      setError('A confirmacao da senha nao confere.');
      setLoading(false);
      return;
    }

    try {
      await apiClientFetch('/v1/auth/change-temporary-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      router.push('/');
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao atualizar a senha.');
      setLoading(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="currentPassword">Senha atual</label>
        <input id="currentPassword" name="currentPassword" type="password" required />
      </div>

      <div className="field">
        <label htmlFor="newPassword">Nova senha</label>
        <input id="newPassword" name="newPassword" type="password" required />
      </div>

      <div className="field">
        <label htmlFor="confirmPassword">Confirmar nova senha</label>
        <input id="confirmPassword" name="confirmPassword" type="password" required />
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <button className="primary-button" type="submit" disabled={loading}>
        {loading ? 'Atualizando...' : 'Atualizar senha'}
      </button>
    </form>
  );
}
