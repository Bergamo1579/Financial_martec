'use client';

import { startTransition, useEffect, useState } from 'react';
import type {
  IamRoleItem,
  IamUserDetail,
  IamUserListItem,
  PaginatedResponse,
} from '@financial-martec/contracts';
import { apiClientFetch } from '@/lib/client-api';

type UsersAdminProps = {
  initialUsers: PaginatedResponse<IamUserListItem>;
  roles: IamRoleItem[];
};

export function UsersAdmin({ initialUsers, roles }: UsersAdminProps) {
  const [usersPage, setUsersPage] = useState(initialUsers);
  const [selectedId, setSelectedId] = useState(initialUsers.items[0]?.id ?? '');
  const [selectedUser, setSelectedUser] = useState<IamUserDetail | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) {
      setSelectedUser(null);
      return;
    }

    void loadUser(selectedId);
  }, [selectedId]);

  async function loadUser(userId: string) {
    try {
      const response = await apiClientFetch(`/v1/iam/users/${userId}`, {
        method: 'GET',
        headers: {},
      });
      const payload = (await response.json()) as IamUserDetail;
      startTransition(() => {
        setSelectedUser(payload);
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar usuario.');
    }
  }

  async function reloadUsers(nextSelectedId?: string) {
    const response = await apiClientFetch('/v1/iam/users?page=1&pageSize=50', {
      method: 'GET',
      headers: {},
    });
    const payload = (await response.json()) as PaginatedResponse<IamUserListItem>;

    startTransition(() => {
      setUsersPage(payload);
      const resolvedSelectedId =
        nextSelectedId && payload.items.some((item) => item.id === nextSelectedId)
          ? nextSelectedId
          : payload.items[0]?.id ?? '';
      setSelectedId(resolvedSelectedId);
    });
  }

  async function runAction(actionKey: string, action: () => Promise<void>) {
    setBusy(actionKey);
    setError(null);
    setFeedback(null);

    try {
      await action();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao processar a operacao.');
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateUser(formData: FormData) {
    const selectedRoles = formData.getAll('createRoles').map(String);
    await apiClientFetch('/v1/iam/users', {
      method: 'POST',
      body: JSON.stringify({
        name: String(formData.get('name') ?? ''),
        email: String(formData.get('email') ?? ''),
        password: String(formData.get('password') ?? ''),
        roles: selectedRoles,
        status: String(formData.get('status') ?? 'ACTIVE'),
      }),
    });

    await reloadUsers();
    setFeedback('Usuario criado com senha temporaria e roles iniciais.');
  }

  async function handleSaveProfile(formData: FormData) {
    if (!selectedUser) {
      return;
    }

    await apiClientFetch(`/v1/iam/users/${selectedUser.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: String(formData.get('profileName') ?? ''),
        email: String(formData.get('profileEmail') ?? ''),
      }),
    });

    await reloadUsers(selectedUser.id);
    await loadUser(selectedUser.id);
    setFeedback('Dados do usuario atualizados.');
  }

  async function handleReplaceRoles(formData: FormData) {
    if (!selectedUser) {
      return;
    }

    const selectedRoles = formData.getAll('roleAssignments').map(String);
    await apiClientFetch(`/v1/iam/users/${selectedUser.id}/roles`, {
      method: 'PUT',
      body: JSON.stringify({
        roles: selectedRoles,
      }),
    });

    await reloadUsers(selectedUser.id);
    await loadUser(selectedUser.id);
    setFeedback('Roles do usuario atualizadas.');
  }

  async function handleStatus(status: 'ACTIVE' | 'INACTIVE') {
    if (!selectedUser) {
      return;
    }

    await apiClientFetch(`/v1/iam/users/${selectedUser.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });

    await reloadUsers(selectedUser.id);
    await loadUser(selectedUser.id);
    setFeedback(status === 'ACTIVE' ? 'Usuario ativado.' : 'Usuario desativado.');
  }

  async function handleLock() {
    if (!selectedUser) {
      return;
    }

    await apiClientFetch(`/v1/iam/users/${selectedUser.id}/lock`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });

    await reloadUsers(selectedUser.id);
    await loadUser(selectedUser.id);
    setFeedback('Usuario bloqueado.');
  }

  async function handleUnlock() {
    if (!selectedUser) {
      return;
    }

    await apiClientFetch(`/v1/iam/users/${selectedUser.id}/unlock`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });

    await reloadUsers(selectedUser.id);
    await loadUser(selectedUser.id);
    setFeedback('Usuario desbloqueado.');
  }

  async function handleResetPassword(formData: FormData) {
    if (!selectedUser) {
      return;
    }

    await apiClientFetch(`/v1/iam/users/${selectedUser.id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({
        temporaryPassword: String(formData.get('temporaryPassword') ?? ''),
      }),
    });

    await reloadUsers(selectedUser.id);
    await loadUser(selectedUser.id);
    setFeedback('Senha temporaria redefinida.');
  }

  return (
    <div className="admin-grid">
      <section className="table-panel">
        <div className="panel-heading">
          <div>
            <h3>Usuarios</h3>
            <p className="muted">Crie contas, atribua roles, bloqueie ou redefina senhas.</p>
          </div>
          <span className="status-pill">{usersPage.total} contas</span>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {feedback ? <p className="success-text">{feedback}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Status</th>
                <th>Roles</th>
              </tr>
            </thead>
            <tbody>
              {usersPage.items.map((user) => (
                <tr
                  key={user.id}
                  className="clickable-row"
                  data-active={selectedId === user.id}
                  onClick={() => setSelectedId(user.id)}
                >
                  <td className="stack">
                    <strong>{user.name}</strong>
                    <span className="muted">{user.email}</span>
                  </td>
                  <td className="stack">
                    <span>{user.status}</span>
                    {user.lockReason ? <span className="muted">{user.lockReason}</span> : null}
                  </td>
                  <td>{user.roles.join(', ') || 'Sem roles'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-stack">
        <section className="table-panel">
          <div className="panel-heading">
            <div>
              <h3>Novo usuario</h3>
              <p className="muted">A conta nasce com senha temporaria e troca obrigatoria.</p>
            </div>
          </div>

          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              void runAction('create-user', () => handleCreateUser(formData));
            }}
          >
            <div className="field">
              <label htmlFor="name">Nome</label>
              <input id="name" name="name" required />
            </div>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" required />
            </div>
            <div className="field">
              <label htmlFor="password">Senha temporaria</label>
              <input id="password" name="password" type="password" required />
            </div>
            <div className="field">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue="ACTIVE">
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
            <div className="field">
              <label>Roles iniciais</label>
              <div className="checkbox-grid">
                {roles.map((role) => (
                  <label key={role.id} className="check-item">
                    <input type="checkbox" name="createRoles" value={role.name} />
                    <span>{role.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <button className="primary-button" type="submit" disabled={busy === 'create-user'}>
              {busy === 'create-user' ? 'Criando...' : 'Criar usuario'}
            </button>
          </form>
        </section>

        {selectedUser ? (
          <section className="table-panel">
            <div className="panel-heading">
              <div>
                <h3>{selectedUser.name}</h3>
                <p className="muted">{selectedUser.email}</p>
              </div>
              <span className="status-pill">{selectedUser.status}</span>
            </div>

            <div className="admin-stack">
              <form
                className="form-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  void runAction('save-profile', () => handleSaveProfile(formData));
                }}
              >
                <div className="field">
                  <label htmlFor="profileName">Nome</label>
                  <input id="profileName" name="profileName" defaultValue={selectedUser.name} required />
                </div>
                <div className="field">
                  <label htmlFor="profileEmail">E-mail</label>
                  <input
                    id="profileEmail"
                    name="profileEmail"
                    type="email"
                    defaultValue={selectedUser.email}
                    required
                  />
                </div>
                <button className="secondary-button" type="submit" disabled={busy === 'save-profile'}>
                  Salvar dados
                </button>
              </form>

              <form
                className="form-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  void runAction('save-roles', () => handleReplaceRoles(formData));
                }}
              >
                <div className="field">
                  <label>Roles</label>
                  <div className="checkbox-grid">
                    {roles.map((role) => (
                      <label key={role.id} className="check-item">
                        <input
                          type="checkbox"
                          name="roleAssignments"
                          value={role.name}
                          defaultChecked={selectedUser.roles.includes(role.name)}
                        />
                        <span>{role.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button className="secondary-button" type="submit" disabled={busy === 'save-roles'}>
                  Atualizar roles
                </button>
              </form>

              <form
                className="form-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  void runAction('reset-password', () => handleResetPassword(formData));
                }}
              >
                <div className="field">
                  <label htmlFor="temporaryPassword">Nova senha temporaria</label>
                  <input id="temporaryPassword" name="temporaryPassword" type="password" required />
                </div>
                <button
                  className="secondary-button"
                  type="submit"
                  disabled={busy === 'reset-password'}
                >
                  Redefinir senha
                </button>
              </form>

              <div className="inline-actions">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy === 'activate'}
                  onClick={() => void runAction('activate', () => handleStatus('ACTIVE'))}
                >
                  Ativar
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy === 'deactivate'}
                  onClick={() => void runAction('deactivate', () => handleStatus('INACTIVE'))}
                >
                  Desativar
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy === 'lock'}
                  onClick={() => void runAction('lock', handleLock)}
                >
                  Bloquear
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy === 'unlock'}
                  onClick={() => void runAction('unlock', handleUnlock)}
                >
                  Desbloquear
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="table-panel">
            <p className="muted">Selecione um usuario para editar.</p>
          </section>
        )}
      </section>
    </div>
  );
}
