import type { AppScreenItem, IamPermissionItem } from '@financial-martec/contracts';
import { PermissionsAdmin } from '@/components/admin/permissions-admin';
import { apiFetchJson, requireScreen } from '@/lib/server-api';

export default async function BackofficePermissionsPage() {
  const [, [permissions, screens]] = await Promise.all([
    requireScreen('/backoffice/permissoes', 'BACKOFFICE'),
    Promise.all([
      apiFetchJson<IamPermissionItem[]>('/v1/iam/permissions'),
      apiFetchJson<AppScreenItem[]>('/v1/iam/screens'),
    ]),
  ]);

  return (
    <section className="content-stack">
      <div className="hero-panel">
        <span className="eyebrow">Permissoes</span>
        <h2 className="auth-title">Acesso por tela e rota.</h2>
        <p className="auth-copy">
          Controle como cada permissao libera telas especificas do sistema.
        </p>
      </div>

      <PermissionsAdmin initialPermissions={permissions} screens={screens} />
    </section>
  );
}
