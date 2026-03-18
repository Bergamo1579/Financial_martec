import Link from 'next/link';
import { LoginForm } from '@/components/login-form';
import styles from './login.module.css';

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.badge}>Financial Martec</span>

          <h1 className={styles.headline}>
            Backoffice
            <br />
            financeiro.
          </h1>

          <p className={styles.tagline}>
            Gestão segura, auditoria contínua e controle operacional do ecossistema — tudo num único
            painel.
          </p>

          <ul className={styles.perks}>
            <li>Sessões com refresh rotativo e revogação</li>
            <li>Permissões carregadas por contexto</li>
            <li>Contratos de leitura estabilizados</li>
          </ul>
        </div>

        <div className={styles.formSide}>
          <div className={styles.formInner}>
            <h2 className={styles.formTitle}>Entrar</h2>
            <p className={styles.formSub}>
              Acesse com suas credenciais do backoffice.
            </p>

            <LoginForm />
          </div>

          <p className={styles.note}>
            <Link href="/docs" className={styles.docsLink}>
              Documentação do sistema&nbsp;&thinsp;→
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
