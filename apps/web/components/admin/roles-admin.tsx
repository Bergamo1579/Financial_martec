'use client';

import { startTransition, useEffect, useState } from 'react';
import type { IamPermissionItem, IamRoleItem } from '@financial-martec/contracts';
import { apiClientFetch } from '@/lib/client-api';

type RolesAdminProps = {
  initialRoles: IamRoleItem[];
  permissions: IamPermissionItem[];
};

export function RolesAdmin({ initialRoles, permissions }: RolesAdminProps) {
  const [roles, setRoles] = useState(initialRoles);
  const [selectedId, setSelectedId] = useState(initialRoles[0]?.id ?? '');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const selectedRole = roles.find((role) => role.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && roles[0]) {
      setSelectedId(roles[0].id);
    }
  }, [roles, selectedId]);

  async function reloadRoles(nextSelectedId?: string) {
    const response = await apiClientFetch('/v1/iam/roles', {
      method: 'GET',
      headers: {},
    });
    const payload = (await response.json()) as IamRoleItem[];

    startTransition(() => {
      setRoles(payload);
      setSelectedId(nextSelectedId ?? payload[0]?.id ?? '');
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

  async function handleCreate(formData: FormData) {
    await apiClientFetch('/v1/iam/roles', {
      method: 'POST',
      body: JSON.stringify({
        name: String(formData.get('createRoleName') ?? ''),
        description: String(formData.get('createRoleDescription') ?? ''),
        scope: String(formData.get('createRoleScope') ?? 'APP'),
      }),
    });

    await reloadRoles();
    setFeedback('Role criada com sucesso.');
  }

  async function handleSave(formData: FormData) {
    if (!selectedRole) {
      return;
    }

    await apiClientFetch(`/v1/iam/roles/${selectedRole.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: String(formData.get('roleName') ?? ''),
        description: String(formData.get('roleDescription') ?? ''),
        scope: String(formData.get('roleScope') ?? selectedRole.scope),
        isActive: Boolean(formData.get('roleIsActive')),
      }),
    });

    await reloadRoles(selectedRole.id);
    setFeedback('Role atualizada.');
  }

  async function handleReplacePermissions(formData: FormData) {
    if (!selectedRole) {
      return;
    }

    const permissionNames = formData.getAll('rolePermissions').map(String);
    await apiClientFetch(`/v1/iam/roles/${selectedRole.id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({
        permissions: permissionNames,
      }),
    });

    await reloadRoles(selectedRole.id);
    setFeedback('Permissoes da role atualizadas.');
  }

  return (
    <div className="admin-grid">
      <section className="table-panel">
        <div className="panel-heading">
          <div>
            <h3>Roles</h3>
            <p className="muted">Perfis administrativos e de aplicacao.</p>
          </div>
          <span className="status-pill">{roles.length} roles</span>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {feedback ? <p className="success-text">{feedback}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th>Escopo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr
                  key={role.id}
                  className="clickable-row"
                  data-active={selectedId === role.id}
                  onClick={() => setSelectedId(role.id)}
                >
                  <td className="stack">
                    <strong>{role.name}</strong>
                    <span className="muted">{role.description ?? 'Sem descricao'}</span>
                  </td>
                  <td>{role.scope}</td>
                  <td>{role.isActive ? 'ATIVA' : 'INATIVA'}</td>
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
              <h3>Nova role</h3>
              <p className="muted">Crie perfis para backoffice, app ou ambos.</p>
            </div>
          </div>

          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              void runAction('create-role', () => handleCreate(formData));
            }}
          >
            <div className="field">
              <label htmlFor="createRoleName">Nome</label>
              <input id="createRoleName" name="createRoleName" required />
            </div>
            <div className="field">
              <label htmlFor="createRoleDescription">Descricao</label>
              <input id="createRoleDescription" name="createRoleDescription" />
            </div>
            <div className="field">
              <label htmlFor="createRoleScope">Escopo</label>
              <select id="createRoleScope" name="createRoleScope" defaultValue="APP">
                <option value="BACKOFFICE">BACKOFFICE</option>
                <option value="APP">APP</option>
                <option value="BOTH">BOTH</option>
              </select>
            </div>
            <button className="primary-button" type="submit" disabled={busy === 'create-role'}>
              {busy === 'create-role' ? 'Criando...' : 'Criar role'}
            </button>
          </form>
        </section>

        {selectedRole ? (
          <section className="table-panel">
            <div className="panel-heading">
              <div>
                <h3>{selectedRole.name}</h3>
                <p className="muted">
                  {selectedRole.isSystem ? 'Role de sistema protegida.' : 'Role administravel.'}
                </p>
              </div>
            </div>

            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                void runAction('save-role', () => handleSave(formData));
              }}
            >
              <div className="field">
                <label htmlFor="roleName">Nome</label>
                <input
                  id="roleName"
                  name="roleName"
                  defaultValue={selectedRole.name}
                  disabled={selectedRole.isSystem}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="roleDescription">Descricao</label>
                <input
                  id="roleDescription"
                  name="roleDescription"
                  defaultValue={selectedRole.description ?? ''}
                />
              </div>
              <div className="field">
                <label htmlFor="roleScope">Escopo</label>
                <select
                  id="roleScope"
                  name="roleScope"
                  defaultValue={selectedRole.scope}
                  disabled={selectedRole.isSystem}
                >
                  <option value="BACKOFFICE">BACKOFFICE</option>
                  <option value="APP">APP</option>
                  <option value="BOTH">BOTH</option>
                </select>
              </div>
              <label className="check-item">
                <input
                  type="checkbox"
                  name="roleIsActive"
                  defaultChecked={selectedRole.isActive}
                  disabled={selectedRole.isSystem}
                />
                <span>Role ativa</span>
              </label>
              <button className="secondary-button" type="submit" disabled={busy === 'save-role'}>
                Salvar role
              </button>
            </form>

            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                void runAction('save-role-permissions', () => handleReplacePermissions(formData));
              }}
            >
              <div className="field">
                <label>Permissoes</label>
                <div className="checkbox-grid">
                  {permissions.map((permission) => (
                    <label key={permission.id} className="check-item">
                      <input
                        type="checkbox"
                        name="rolePermissions"
                        value={permission.name}
                        defaultChecked={selectedRole.permissions.includes(permission.name)}
                        disabled={selectedRole.isSystem}
                      />
                      <span>{permission.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button
                className="secondary-button"
                type="submit"
                disabled={busy === 'save-role-permissions' || selectedRole.isSystem}
              >
                Atualizar permissoes
              </button>
            </form>
          </section>
        ) : null}
      </section>
    </div>
  );
}
