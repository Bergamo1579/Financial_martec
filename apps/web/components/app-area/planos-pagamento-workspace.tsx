'use client';

import { startTransition, useEffect, useState } from 'react';
import type {
  PaginatedResponse,
  PlanoPagamentoDetail,
  PlanoPagamentoListItem,
} from '@financial-martec/contracts';
import { apiClientFetch } from '@/lib/client-api';
import { formatCurrency, formatDateTime, formatPlanoStatus } from './format';

type PlanosPagamentoWorkspaceProps = {
  initialPlanos: PaginatedResponse<PlanoPagamentoListItem>;
  initialPlano: PlanoPagamentoDetail | null;
  canManage: boolean;
};

const defaultListQuery = 'page=1&pageSize=20';

export function PlanosPagamentoWorkspace({
  initialPlanos,
  initialPlano,
  canManage,
}: PlanosPagamentoWorkspaceProps) {
  const [planosPage, setPlanosPage] = useState(initialPlanos);
  const [selectedId, setSelectedId] = useState(initialPlano?.id ?? initialPlanos.items[0]?.id ?? '');
  const [selectedPlano, setSelectedPlano] = useState<PlanoPagamentoDetail | null>(initialPlano);
  const [activeQuery, setActiveQuery] = useState(defaultListQuery);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) {
      setSelectedPlano(null);
      return;
    }

    void loadPlano(selectedId);
  }, [selectedId]);

  async function loadPlano(id: string) {
    try {
      const response = await apiClientFetch(`/v1/app/planos-pagamento/${id}`, {
        method: 'GET',
        headers: {},
      });
      const payload = (await response.json()) as PlanoPagamentoDetail;
      startTransition(() => {
        setSelectedPlano(payload);
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar plano.');
    }
  }

  async function reloadPlanos(queryString = activeQuery, nextSelectedId?: string) {
    const response = await apiClientFetch(`/v1/app/planos-pagamento?${queryString}`, {
      method: 'GET',
      headers: {},
    });
    const payload = (await response.json()) as PaginatedResponse<PlanoPagamentoListItem>;

    startTransition(() => {
      setPlanosPage(payload);
      setActiveQuery(queryString);
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

  async function handleFilter(formData: FormData) {
    const params = new URLSearchParams({
      page: '1',
      pageSize: '20',
    });
    const search = String(formData.get('search') ?? '').trim();
    const status = String(formData.get('status') ?? '').trim();
    if (search) {
      params.set('search', search);
    }
    if (status) {
      params.set('status', status);
    }

    await reloadPlanos(params.toString());
  }

  async function handleCreate(formData: FormData) {
    const response = await apiClientFetch('/v1/app/planos-pagamento', {
      method: 'POST',
      body: JSON.stringify({
        nome: String(formData.get('nome') ?? ''),
        valorTotal: Number(formData.get('valorTotal') ?? 0),
        quantidadeMeses: Number(formData.get('quantidadeMeses') ?? 0),
        diaVencimento: Number(formData.get('diaVencimento') ?? 0),
        status: String(formData.get('status') ?? 'ATIVO'),
      }),
    });
    const payload = (await response.json()) as PlanoPagamentoDetail;
    await reloadPlanos(activeQuery, payload.id);
    setFeedback('Plano criado.');
  }

  async function handleUpdate(formData: FormData) {
    if (!selectedPlano) {
      return;
    }

    await apiClientFetch(`/v1/app/planos-pagamento/${selectedPlano.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        nome: String(formData.get('editNome') ?? ''),
        valorTotal: Number(formData.get('editValorTotal') ?? 0),
        quantidadeMeses: Number(formData.get('editQuantidadeMeses') ?? 0),
        diaVencimento: Number(formData.get('editDiaVencimento') ?? 0),
        status: String(formData.get('editStatus') ?? selectedPlano.status),
      }),
    });

    await reloadPlanos(activeQuery, selectedPlano.id);
    await loadPlano(selectedPlano.id);
    setFeedback('Plano atualizado.');
  }

  async function handleStatusUpdate(status: 'ATIVO' | 'INATIVO') {
    if (!selectedPlano) {
      return;
    }

    await apiClientFetch(`/v1/app/planos-pagamento/${selectedPlano.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });

    await reloadPlanos(activeQuery, selectedPlano.id);
    await loadPlano(selectedPlano.id);
    setFeedback(status === 'ATIVO' ? 'Plano ativado.' : 'Plano inativado.');
  }

  return (
    <div className="admin-grid">
      <section className="table-panel">
        <div className="panel-heading">
          <div>
            <h3>Planos de pagamento</h3>
            <p className="muted">Catalogo local reutilizavel para a fase comercial e financeira futura.</p>
          </div>
          <span className="status-pill">{planosPage.total} planos</span>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {feedback ? <p className="success-text">{feedback}</p> : null}

        <div className="table-toolbar">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              void runAction('filter-planos', () => handleFilter(formData));
            }}
          >
            <input name="search" placeholder="Buscar por nome" />
            <select name="status" defaultValue="">
              <option value="">Todos os status</option>
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
            </select>
            <button className="secondary-button" type="submit" disabled={busy === 'filter-planos'}>
              Filtrar
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void runAction('reset-planos', () => reloadPlanos(defaultListQuery))}
            >
              Limpar
            </button>
          </form>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Plano</th>
                <th>Valor</th>
                <th>Meses</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {planosPage.items.map((plano) => (
                <tr
                  key={plano.id}
                  className="clickable-row"
                  data-active={selectedId === plano.id}
                  onClick={() => setSelectedId(plano.id)}
                >
                  <td className="stack">
                    <strong>{plano.nome}</strong>
                    <span className="muted">Vencimento dia {plano.diaVencimento}</span>
                  </td>
                  <td>{formatCurrency(plano.valorTotal)}</td>
                  <td>{plano.quantidadeMeses}</td>
                  <td>{formatPlanoStatus(plano.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-stack">
        {canManage ? (
          <section className="table-panel">
            <div className="panel-heading">
              <div>
                <h3>Novo plano</h3>
                <p className="muted">O catalogo nasce reutilizavel e sem vinculo contratual nesta fase.</p>
              </div>
            </div>

            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                void runAction('create-plano', () => handleCreate(formData));
              }}
            >
              <div className="field">
                <label htmlFor="nome">Nome</label>
                <input id="nome" name="nome" required />
              </div>
              <div className="field">
                <label htmlFor="valorTotal">Valor total</label>
                <input id="valorTotal" name="valorTotal" type="number" min="0.01" step="0.01" required />
              </div>
              <div className="field">
                <label htmlFor="quantidadeMeses">Quantidade de meses</label>
                <input id="quantidadeMeses" name="quantidadeMeses" type="number" min="1" required />
              </div>
              <div className="field">
                <label htmlFor="diaVencimento">Dia de vencimento</label>
                <input id="diaVencimento" name="diaVencimento" type="number" min="1" max="31" required />
              </div>
              <div className="field">
                <label htmlFor="status">Status</label>
                <select id="status" name="status" defaultValue="ATIVO">
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                </select>
              </div>
              <button className="primary-button" type="submit" disabled={busy === 'create-plano'}>
                {busy === 'create-plano' ? 'Criando...' : 'Criar plano'}
              </button>
            </form>
          </section>
        ) : null}

        {selectedPlano ? (
          <section className="table-panel">
            <div className="panel-heading">
              <div>
                <h3>{selectedPlano.nome}</h3>
                <p className="muted">Atualizado em {formatDateTime(selectedPlano.updatedAt)}</p>
              </div>
              <span className="status-pill">{formatPlanoStatus(selectedPlano.status)}</span>
            </div>

            <div className="detail-grid">
              <div className="detail-card">
                <span className="detail-label">Valor total</span>
                <strong>{formatCurrency(selectedPlano.valorTotal)}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">Meses</span>
                <strong>{selectedPlano.quantidadeMeses}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">Vencimento</span>
                <strong>Dia {selectedPlano.diaVencimento}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">Criacao</span>
                <strong>{formatDateTime(selectedPlano.createdAt)}</strong>
              </div>
            </div>

            {canManage ? (
              <div className="admin-stack">
                <form
                  className="form-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    void runAction('update-plano', () => handleUpdate(formData));
                  }}
                >
                  <div className="field">
                    <label htmlFor="editNome">Nome</label>
                    <input id="editNome" name="editNome" defaultValue={selectedPlano.nome} required />
                  </div>
                  <div className="field">
                    <label htmlFor="editValorTotal">Valor total</label>
                    <input
                      id="editValorTotal"
                      name="editValorTotal"
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={selectedPlano.valorTotal}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="editQuantidadeMeses">Quantidade de meses</label>
                    <input
                      id="editQuantidadeMeses"
                      name="editQuantidadeMeses"
                      type="number"
                      min="1"
                      defaultValue={selectedPlano.quantidadeMeses}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="editDiaVencimento">Dia de vencimento</label>
                    <input
                      id="editDiaVencimento"
                      name="editDiaVencimento"
                      type="number"
                      min="1"
                      max="31"
                      defaultValue={selectedPlano.diaVencimento}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="editStatus">Status</label>
                    <select id="editStatus" name="editStatus" defaultValue={selectedPlano.status}>
                      <option value="ATIVO">Ativo</option>
                      <option value="INATIVO">Inativo</option>
                    </select>
                  </div>
                  <button className="secondary-button" type="submit" disabled={busy === 'update-plano'}>
                    Salvar plano
                  </button>
                </form>

                <div className="inline-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={busy === 'activate-plano'}
                    onClick={() => void runAction('activate-plano', () => handleStatusUpdate('ATIVO'))}
                  >
                    Ativar
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={busy === 'deactivate-plano'}
                    onClick={() => void runAction('deactivate-plano', () => handleStatusUpdate('INATIVO'))}
                  >
                    Inativar
                  </button>
                </div>
              </div>
            ) : null}

            <div className="subpanel">
              <div className="panel-heading">
                <div>
                  <h3>Uso futuro esperado</h3>
                  <p className="muted">Contexto planejado para a fase contratual e de cobranca.</p>
                </div>
              </div>
              <ul className="plain-list">
                {selectedPlano.usoFuturoEsperado.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>
        ) : (
          <section className="table-panel">
            <p className="muted">Selecione um plano para visualizar detalhes do catalogo.</p>
          </section>
        )}
      </section>
    </div>
  );
}
