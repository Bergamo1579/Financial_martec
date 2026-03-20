import { redirect } from 'next/navigation';
import { ChangePasswordForm } from '@/components/change-password-form';
import { requireUser } from '@/lib/server-api';

export default async function ChangePasswordPage() {
  const user = await requireUser();

  if (!user.mustChangePassword) {
    redirect(user.defaultPath);
  }

  return (
    <main className="auth-layout">
      <section className="auth-card">
        <span className="eyebrow">Senha temporaria</span>
        <h1 className="auth-title">Atualize sua senha para continuar.</h1>
        <p className="auth-copy">
          Esta conta esta marcada para troca obrigatoria de senha antes do acesso ao sistema.
        </p>
        <ChangePasswordForm />
      </section>
    </main>
  );
}
