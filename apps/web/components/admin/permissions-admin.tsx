'use client';

import { startTransition, useEffect, useState } from 'react';
import type { AppScreenItem, IamPermissionItem } from '@financial-martec/contracts';
import { apiClientFetch } from '@/lib/client-api';

type PermissionsAdminProps = {
  initialPermissions: IamPermissionItem[];
  screens: AppScreenItem[];
};

export function PermissionsAdmin({
  initialPermissions,
  screens,
}: PermissionsAdminProps) {
  const [permissions, setPermissions] = useState(initialPermissions);
  const [selectedId, setSelectedId] = useState(initialPermissions[0]?.id ?? '');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const selectedPermission = permissions.find((permission) => permission.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && permissions[0]) {
      setSelectedId(permissions[0].id);
    }
  }, [permissions, selectedId]);

  async function reloadPermissions(nextSelectedId?: string) {
    const response = await apiClientFetch('/v1/iam/permissions', {
      method: 'GET',
      headers: {},
    });
    const payload = (await response.json()) as IamPermissionItem[];

    startTransition(() => {
      setPermissions(payload);
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
    await apiClientFetch('/v1/iam/permissions', {
      method: 'POST',
      body: JSON.stringify({
        name: String(formData.get('createPermissionName') ?? ''),
        description: String(formData.get('createPermissionDescription') ?? ''),
        scope: String(formData.get('createPermissionScope') ?? 'APP'),
      }),
    });

    await reloadPermissions();
    setFeedback('Permissao criada com sucesso.');
  }

  async function handleSave(formData: FormData) {
    if (!selectedPermission) {
      return;
    }

    await apiClientFetch(`/v1/iam/permissions/${selectedPermission.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: String(formData.get('permissionName') ?? ''),
        description: String(formData.get('permissionDescription') ?? ''),
        scope: String(formData.get('permissionScope') ?? selectedPermission.scope),
        isActive: Boolean(formData.get('permissionIsActive')),
      }),
    });

    await reloadPermissions(selectedPermission.id);
    setFeedback('Permissao atualizada.');
  }

  async function handleReplaceScreens(formData: FormData) {
    if (!selectedPermission) {
      return;
    }

    const selectedScreens = formData.getAll('permissionScreens').map(String);
    await apiClientFetch(`/v1/iam/permissions/${selectedPermission.id}/screens`, {
      method: 'PUT',
      body: JSON.stringify({
        screens: selectedScreens,
      }),
    });

    await reloadPermissions(selectedPermission.id);
    setFeedback('Telas vinculadas atualizadas.');
  }

  return (
    <div className="admin-grid">
      <section className="table-panel">
        <div className="panel-heading">
          <div>
            <h3>Permissoes</h3>
            <p className="muted">Catalogo dinamico que governa o acesso as telas.</p>
          </div>
          <span className="status-pill">{permissions.length} permissoes</span>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {feedback ? <p className="success-text">{feedback}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Permissao</th>
                <th>Escopo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((permission) => (
                <tr
                  key={permission.id}
                  className="clickable-row"
                  data-active={selectedId === permission.id}
                  onClick={() => setSelectedId(permission.id)}
                >
                  <td className="stack">
                    <strong>{permission.name}</strong>
                    <span className="muted">{permission.description ?? 'Sem descricao'}</span>
                  </td>
                  <td>{permission.scope}</td>
                  <td>{permission.isActive ? 'ATIVA' : 'INATIVA'}</td>
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
              <h3>Nova permissao</h3>
              <p className="muted">Crie permissoes para rotas e areas especificas.</p>
            </div>
          </div>

          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              void runAction('create-permission', () => handleCreate(formData));
            }}
          >
            <div className="field">
              <label htmlFor="createPermissionName">Nome</label>
              <input id="createPermissionName" name="createPermissionName" required />
            </div>
            <div className="field">
              <label htmlFor="createPermissionDescription">Descricao</label>
              <input id="createPermissionDescription" name="createPermissionDescription" />
            </div>
            <div className="field">
              <label htmlFor="createPermissionScope">Escopo</label>
              <select id="createPermissionScope" name="createPermissionScope" defaultValue="APP">
                <option value="BACKOFFICE">BACKOFFICE</option>
                <option value="APP">APP</option>
                <option value="BOTH">BOTH</option>
              </select>
            </div>
            <button
              className="primary-button"
              type="submit"
              disabled={busy === 'create-permission'}
            >
              {busy === 'create-permission' ? 'Criando...' : 'Criar permissao'}
            </button>
          </form>
        </section>

        {selectedPermission ? (
          <section className="table-panel">
            <div className="panel-heading">
              <div>
                <h3>{selectedPermission.name}</h3>
                <p className="muted">
                  {selectedPermission.isSystem
                    ? 'Permissao de sistema com campos protegidos.'
                    : 'Permissao administravel.'}
                </p>
              </div>
            </div>

            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                void runAction('save-permission', () => handleSave(formData));
              }}
            >
              <div className="field">
                <label htmlFor="permissionName">Nome</label>
                <input
                  id="permissionName"
                  name="permissionName"
                  defaultValue={selectedPermission.name}
                  disabled={selectedPermission.isSystem}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="permissionDescription">Descricao</label>
                <input
                  id="permissionDescription"
                  name="permissionDescription"
                  defaultValue={selectedPermission.description ?? ''}
                />
              </div>
              <div className="field">
                <label htmlFor="permissionScope">Escopo</label>
                <select
                  id="permissionScope"
                  name="permissionScope"
                  defaultValue={selectedPermission.scope}
                  disabled={selectedPermission.isSystem}
                >
                  <option value="BACKOFFICE">BACKOFFICE</option>
                  <option value="APP">APP</option>
                  <option value="BOTH">BOTH</option>
                </select>
              </div>
              <label className="check-item">
                <input
                  type="checkbox"
                  name="permissionIsActive"
                  defaultChecked={selectedPermission.isActive}
                  disabled={selectedPermission.isSystem}
                />
                <span>Permissao ativa</span>
              </label>
              <button
                className="secondary-button"
                type="submit"
                disabled={busy === 'save-permission'}
              >
                Salvar permissao
              </button>
            </form>

            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                void runAction('save-screens', () => handleReplaceScreens(formData));
              }}
            >
              <div className="field">
                <label>Telas vinculadas</label>
                <div className="checkbox-grid">
                  {screens.map((screen) => (
                    <label key={screen.id} className="check-item">
                      <input
                        type="checkbox"
                        name="permissionScreens"
                        value={screen.key}
                        defaultChecked={selectedPermission.screens.includes(screen.key)}
                      />
                      <span>{screen.title}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button className="secondary-button" type="submit" disabled={busy === 'save-screens'}>
                Atualizar telas
              </button>
            </form>
          </section>
        ) : null}
      </section>
    </div>
  );
}
