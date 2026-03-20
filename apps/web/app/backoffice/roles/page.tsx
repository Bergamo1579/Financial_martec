import type { IamPermissionItem, IamRoleItem } from '@financial-martec/contracts';
import { RolesAdmin } from '@/components/admin/roles-admin';
import { apiFetchJson, requireScreen } from '@/lib/server-api';

export default async function BackofficeRolesPage() {
  const [, [roles, permissions]] = await Promise.all([
    requireScreen('/backoffice/roles', 'BACKOFFICE'),
    Promise.all([
      apiFetchJson<IamRoleItem[]>('/v1/iam/roles'),
      apiFetchJson<IamPermissionItem[]>('/v1/iam/permissions'),
    ]),
  ]);

  return (
    <section className="content-stack">
      <div className="hero-panel">
        <span className="eyebrow">Roles</span>
        <h2 className="auth-title">Perfis e escopos de acesso.</h2>
        <p className="auth-copy">
          Defina roles para o backoffice, para a aplicacao ou para uso em ambos os ambientes.
        </p>
      </div>

      <RolesAdmin initialRoles={roles} permissions={permissions} />
    </section>
  );
}
