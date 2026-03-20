import { ForbiddenActions } from '@/components/forbidden-actions';
import { requireBootstrap } from '@/lib/server-api';

export default async function ForbiddenPage() {
  const bootstrap = await requireBootstrap();
  const hasAnyAccessibleScreen = bootstrap.navigation.items.length > 0;
  const targetPath = hasAnyAccessibleScreen ? bootstrap.navigation.defaultPath : null;

  return (
    <main className="auth-layout">
      <section className="auth-card">
        <span className="eyebrow">Acesso negado</span>
        <h1 className="auth-title">Voce nao tem permissao para esta area.</h1>
        <p className="auth-copy">
          {targetPath
            ? 'Seu acesso foi redirecionado para a primeira area disponivel no perfil.'
            : 'Sua conta nao possui nenhuma area liberada. O acesso sera encerrado e voce voltara para o login.'}
        </p>
        <ForbiddenActions targetPath={targetPath} />
      </section>
    </main>
  );
}
