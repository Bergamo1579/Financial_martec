import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <main className="auth-layout">
      <section className="auth-card">
        <span className="eyebrow">MVP Backoffice</span>
        <h1 className="auth-title">Login próprio, seguro e isolado do domínio financeiro.</h1>
        <p className="auth-copy">
          Esta base já nasce separada do pedagógico para proteger sessão, auditoria e permissões.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
