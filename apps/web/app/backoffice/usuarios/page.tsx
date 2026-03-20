import type { IamRoleItem, IamUserListItem, PaginatedResponse } from '@financial-martec/contracts';
import { UsersAdmin } from '@/components/admin/users-admin';
import { apiFetchJson, requireScreen } from '@/lib/server-api';

export default async function BackofficeUsersPage() {
  const [, [users, roles]] = await Promise.all([
    requireScreen('/backoffice/usuarios', 'BACKOFFICE'),
    Promise.all([
      apiFetchJson<PaginatedResponse<IamUserListItem>>('/v1/iam/users?page=1&pageSize=50'),
      apiFetchJson<IamRoleItem[]>('/v1/iam/roles'),
    ]),
  ]);

  return (
    <section className="content-stack">
      <div className="hero-panel">
        <span className="eyebrow">Usuarios</span>
        <h2 className="auth-title">Administracao de identidades.</h2>
        <p className="auth-copy">
          Crie contas, atribua roles, bloqueie acessos e redefina senhas temporarias.
        </p>
      </div>

      <UsersAdmin initialUsers={users} roles={roles} />
    </section>
  );
}
