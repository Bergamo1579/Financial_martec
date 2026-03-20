import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LoginForm } from '@/components/login-form';
import { getOptionalUser } from '@/lib/server-api';
import styles from './login.module.css';

export default async function LoginPage() {
  const user = await getOptionalUser();
  if (user) {
    redirect(user.defaultPath);
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.badge}>Financial Martec</span>

          <h1 className={styles.headline}>
            Acesso unico
            <br />
            ao sistema.
          </h1>

          <p className={styles.tagline}>
            Entre com seu usuario para acessar o backoffice administrativo ou a area
            operacional da aplicacao conforme as permissoes da sua conta.
          </p>

          <ul className={styles.perks}>
            <li>Login unico para backoffice e area comum</li>
            <li>Permissoes carregadas por rota e tela</li>
            <li>Senha temporaria, bloqueio e desbloqueio administrativo</li>
          </ul>
        </div>

        <div className={styles.formSide}>
          <div className={styles.formInner}>
            <h2 className={styles.formTitle}>Entrar</h2>
            <p className={styles.formSub}>
              Use suas credenciais e continue no ambiente liberado para o seu perfil.
            </p>

            <LoginForm />
          </div>

          <p className={styles.note}>
            <Link href="/docs" className={styles.docsLink}>
              Documentacao do sistema
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
