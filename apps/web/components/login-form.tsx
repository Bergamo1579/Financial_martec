'use client';

import { FormEvent, useRef, useState } from 'react';
import type { AuthUserResponse } from '@financial-martec/contracts';

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const pwRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');

    let response: Response;

    try {
      response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });
    } catch {
      setError('Nao foi possivel conectar ao servidor de autenticacao.');
      setLoading(false);
      return;
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      setError(payload?.message ?? 'Falha ao autenticar.');
      setLoading(false);
      return;
    }

    const payload = (await response.json()) as { user: AuthUserResponse };
    // Hard redirect so the browser sends the freshly-set cookies on the next
    // request and the Next.js middleware can validate the session correctly.
    window.location.href = payload.user.defaultPath;
  }

  function togglePw() {
    setShowPw((value) => !value);
    requestAnimationFrame(() => {
      const input = pwRef.current;
      if (!input) {
        return;
      }

      input.focus();
      const length = input.value.length;
      input.setSelectionRange(length, length);
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="seu@email.com"
          required
          autoComplete="email"
        />
      </div>

      <div className="field">
        <label htmlFor="password">Senha</label>
        <div className="pw-wrap">
          <input
            ref={pwRef}
            id="password"
            name="password"
            type={showPw ? 'text' : 'password'}
            placeholder="********"
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            className="pw-toggle"
            onClick={togglePw}
            aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}
            tabIndex={-1}
          >
            {showPw ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <button className="primary-button" type="submit" disabled={loading}>
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  );
}
