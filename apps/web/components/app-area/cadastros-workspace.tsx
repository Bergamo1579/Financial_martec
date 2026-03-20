'use client';

import { startTransition, useEffect, useState } from 'react';
import type {
  AppCompanyListItem,
  CadastroDetail,
  CadastroListItem,
  PaginatedResponse,
} from '@financial-martec/contracts';
import { apiClientFetch } from '@/lib/client-api';
import {
  formatCadastroStatus,
  formatDateTime,
  formatIndicacaoStatus,
  formatStudyPeriod,
} from './format';

type CadastrosWorkspaceProps = {
  initialCadastros: PaginatedResponse<CadastroListItem>;
  initialCadastro: CadastroDetail | null;
  companyOptions: AppCompanyListItem[];
  canManage: boolean;
};

const defaultListQuery = 'page=1&pageSize=20';

export function CadastrosWorkspace({
  initialCadastros,
  initialCadastro,
  companyOptions,
  canManage,
}: CadastrosWorkspaceProps) {
  const [cadastrosPage, setCadastrosPage] = useState(initialCadastros);
  const [selectedId, setSelectedId] = useState(initialCadastro?.id ?? initialCadastros.items[0]?.id ?? '');
  const [selectedCadastro, setSelectedCadastro] = useState<CadastroDetail | null>(initialCadastro);
  const [activeQuery, setActiveQuery] = useState(defaultListQuery);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) {
      setSelectedCadastro(null);
      return;
    }

    void loadCadastro(selectedId);
  }, [selectedId]);

  async function loadCadastro(id: string) {
    try {
      const response = await apiClientFetch(`/v1/app/cadastros/${id}`, { method: 'GET', headers: {} });
      const payload = (await response.json()) as CadastroDetail;
      startTransition(() => {
        setSelectedCadastro(payload);
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar cadastro.');
    }
  }

  async function reloadCadastros(queryString = activeQuery, nextSelectedId?: string) {
    const response = await apiClientFetch(`/v1/app/cadastros?${queryString}`, {
      method: 'GET',
      headers: {},
    });
    const payload = (await response.json()) as PaginatedResponse<CadastroListItem>;

    startTransition(() => {
      setCadastrosPage(payload);
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
    const periodoEstudo = String(formData.get('periodoEstudo') ?? '').trim();
    const includeDeleted = formData.get('includeDeleted') === 'on';

    if (search) {
      params.set('search', search);
    }
    if (status) {
      params.set('status', status);
    }
    if (periodoEstudo) {
      params.set('periodoEstudo', periodoEstudo);
    }
    if (includeDeleted) {
      params.set('includeDeleted', 'true');
    }

    await reloadCadastros(params.toString());
  }

  async function handleCreate(formData: FormData) {
    const response = await apiClientFetch('/v1/app/cadastros', {
      method: 'POST',
      body: JSON.stringify({
        nomeCompleto: String(formData.get('nomeCompleto') ?? ''),
        telefone: String(formData.get('telefone') ?? ''),
        cpf: String(formData.get('cpf') ?? ''),
        nomeResponsavel: String(formData.get('nomeResponsavel') ?? ''),
        periodoEstudo: String(formData.get('periodoEstudo') ?? 'MANHA'),
      }),
    });
    const payload = (await response.json()) as CadastroDetail;
    await reloadCadastros(activeQuery, payload.id);
    setFeedback('Cadastro criado.');
  }

  async function handleUpdate(formData: FormData) {
    if (!selectedCadastro) {
      return;
    }

    await apiClientFetch(`/v1/app/cadastros/${selectedCadastro.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        nomeCompleto: String(formData.get('editNomeCompleto') ?? ''),
        telefone: String(formData.get('editTelefone') ?? ''),
        cpf: String(formData.get('editCpf') ?? ''),
        nomeResponsavel: String(formData.get('editNomeResponsavel') ?? ''),
        periodoEstudo: String(formData.get('editPeriodoEstudo') ?? ''),
      }),
    });

    await reloadCadastros(activeQuery, selectedCadastro.id);
    await loadCadastro(selectedCadastro.id);
    setFeedback('Cadastro atualizado.');
  }

  async function handleArchive() {
    if (!selectedCadastro) {
      return;
    }

    await apiClientFetch(`/v1/app/cadastros/${selectedCadastro.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ archive: true }),
    });

    await reloadCadastros(activeQuery, selectedCadastro.id);
    await loadCadastro(selectedCadastro.id);
    setFeedback('Cadastro arquivado.');
  }

  async function handleDelete() {
    if (!selectedCadastro) {
      return;
    }

    await apiClientFetch(`/v1/app/cadastros/${selectedCadastro.id}`, {
      method: 'DELETE',
      body: JSON.stringify({}),
    });

    await reloadCadastros(activeQuery);
    setFeedback('Cadastro excluido logicamente.');
  }

  async function handleIndicar(formData: FormData) {
    if (!selectedCadastro) {
      return;
    }

    await apiClientFetch(`/v1/app/cadastros/${selectedCadastro.id}/indicacoes`, {
      method: 'POST',
      body: JSON.stringify({
        empresaSourceId: String(formData.get('empresaSourceId') ?? ''),
      }),
    });

    await reloadCadastros(activeQuery, selectedCadastro.id);
    await loadCadastro(selectedCadastro.id);
    setFeedback('Indicacao criada.');
  }

  return (
    <div className="admin-grid">
      <section className="table-panel">
        <div className="panel-heading">
          <div>
            <h3>Cadastros</h3>
            <p className="muted">Fluxo local de candidatos antes da matricula no pedagogico.</p>
          </div>
          <span className="status-pill">{cadastrosPage.total} registros</span>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {feedback ? <p className="success-text">{feedback}</p> : null}

        <div className="table-toolbar">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              void runAction('filter-cadastros', () => handleFilter(formData));
            }}
          >
            <input name="search" placeholder="Buscar por nome, CPF, telefone ou responsavel" />
            <select name="status" defaultValue="">
              <option value="">Todos os status</option>
              <option value="ARQUIVADO">Arquivado</option>
              <option value="ENVIADO">Enviado</option>
              <option value="ACEITO">Aceito</option>
              <option value="CONTRATO">Contrato</option>
              <option value="MATRICULADO">Matriculado</option>
            </select>
            <select name="periodoEstudo" defaultValue="">
              <option value="">Todos os periodos</option>
              <option value="MANHA">Manha</option>
              <option value="TARDE">Tarde</option>
              <option value="NOITE">Noite</option>
              <option value="INTEGRAL">Integral</option>
            </select>
            <label className="check-item">
              <input type="checkbox" name="includeDeleted" />
              <span>Mostrar deletados</span>
            </label>
            <button className="secondary-button" type="submit" disabled={busy === 'filter-cadastros'}>
              Filtrar
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void runAction('reset-cadastros', () => reloadCadastros(defaultListQuery))}
            >
              Limpar
            </button>
          </form>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cadastro</th>
                <th>Periodo</th>
                <th>Status</th>
                <th>Atualizacao</th>
              </tr>
            </thead>
            <tbody>
              {cadastrosPage.items.map((cadastro) => (
                <tr
                  key={cadastro.id}
                  className="clickable-row"
                  data-active={selectedId === cadastro.id}
                  onClick={() => setSelectedId(cadastro.id)}
                >
                  <td className="stack">
                    <strong>{cadastro.nomeCompleto}</strong>
                    <span className="muted">{cadastro.cpf}</span>
                    <span className="muted">{cadastro.telefone}</span>
                  </td>
                  <td>{formatStudyPeriod(cadastro.periodoEstudo)}</td>
                  <td className="stack">
                    <span>{formatCadastroStatus(cadastro.status)}</span>
                    {cadastro.deletedAt ? <span className="muted">Deletado</span> : null}
                  </td>
                  <td>{formatDateTime(cadastro.updatedAt)}</td>
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
                <h3>Novo cadastro</h3>
                <p className="muted">A entrada operacional local nasce arquivada e evolui por indicacoes.</p>
              </div>
            </div>

            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                void runAction('create-cadastro', () => handleCreate(formData));
              }}
            >
              <div className="field">
                <label htmlFor="nomeCompleto">Nome completo</label>
                <input id="nomeCompleto" name="nomeCompleto" required />
              </div>
              <div className="field">
                <label htmlFor="telefone">Telefone</label>
                <input id="telefone" name="telefone" required />
              </div>
              <div className="field">
                <label htmlFor="cpf">CPF</label>
                <input id="cpf" name="cpf" required />
              </div>
              <div className="field">
                <label htmlFor="nomeResponsavel">Responsavel</label>
                <input id="nomeResponsavel" name="nomeResponsavel" required />
              </div>
              <div className="field">
                <label htmlFor="periodoEstudo">Periodo de estudo</label>
                <select id="periodoEstudo" name="periodoEstudo" defaultValue="MANHA">
                  <option value="MANHA">Manha</option>
                  <option value="TARDE">Tarde</option>
                  <option value="NOITE">Noite</option>
                  <option value="INTEGRAL">Integral</option>
                </select>
              </div>
              <button className="primary-button" type="submit" disabled={busy === 'create-cadastro'}>
                {busy === 'create-cadastro' ? 'Criando...' : 'Criar cadastro'}
              </button>
            </form>
          </section>
        ) : null}

        {selectedCadastro ? (
          <section className="table-panel">
            <div className="panel-heading">
              <div>
                <h3>{selectedCadastro.nomeCompleto}</h3>
                <p className="muted">{selectedCadastro.nomeResponsavel}</p>
              </div>
              <span className="status-pill">{formatCadastroStatus(selectedCadastro.status)}</span>
            </div>

            <div className="detail-grid">
              <div className="detail-card">
                <span className="detail-label">Telefone</span>
                <strong>{selectedCadastro.telefone}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">CPF</span>
                <strong>{selectedCadastro.cpf}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">Periodo</span>
                <strong>{formatStudyPeriod(selectedCadastro.periodoEstudo)}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">Atualizacao</span>
                <strong>{formatDateTime(selectedCadastro.updatedAt)}</strong>
              </div>
            </div>

            {canManage && !selectedCadastro.deletedAt ? (
              <div className="admin-stack">
                <form
                  className="form-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    void runAction('update-cadastro', () => handleUpdate(formData));
                  }}
                >
                  <div className="field">
                    <label htmlFor="editNomeCompleto">Nome completo</label>
                    <input
                      id="editNomeCompleto"
                      name="editNomeCompleto"
                      defaultValue={selectedCadastro.nomeCompleto}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="editTelefone">Telefone</label>
                    <input
                      id="editTelefone"
                      name="editTelefone"
                      defaultValue={selectedCadastro.telefone}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="editCpf">CPF</label>
                    <input id="editCpf" name="editCpf" defaultValue={selectedCadastro.cpf} required />
                  </div>
                  <div className="field">
                    <label htmlFor="editNomeResponsavel">Responsavel</label>
                    <input
                      id="editNomeResponsavel"
                      name="editNomeResponsavel"
                      defaultValue={selectedCadastro.nomeResponsavel}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="editPeriodoEstudo">Periodo de estudo</label>
                    <select
                      id="editPeriodoEstudo"
                      name="editPeriodoEstudo"
                      defaultValue={selectedCadastro.periodoEstudo}
                    >
                      <option value="MANHA">Manha</option>
                      <option value="TARDE">Tarde</option>
                      <option value="NOITE">Noite</option>
                      <option value="INTEGRAL">Integral</option>
                    </select>
                  </div>
                  <button className="secondary-button" type="submit" disabled={busy === 'update-cadastro'}>
                    Salvar cadastro
                  </button>
                </form>

                {selectedCadastro.canArchive ? (
                  <form
                    className="form-grid"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void runAction('indicar-cadastro', () => handleIndicar(new FormData(event.currentTarget)));
                    }}
                  >
                    <div className="field">
                      <label htmlFor="empresaSourceId">Indicar para empresa</label>
                      <select id="empresaSourceId" name="empresaSourceId" defaultValue="">
                        <option value="">Selecione uma empresa</option>
                        {companyOptions.map((company) => (
                          <option key={company.sourceId} value={company.sourceId}>
                            {company.name} ({company.sourceId})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button className="secondary-button" type="submit" disabled={busy === 'indicar-cadastro'}>
                      Criar indicacao
                    </button>
                  </form>
                ) : null}

                <div className="inline-actions">
                  {selectedCadastro.canArchive ? (
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busy === 'archive-cadastro'}
                      onClick={() => {
                        if (window.confirm('Arquivar este cadastro?')) {
                          void runAction('archive-cadastro', handleArchive);
                        }
                      }}
                    >
                      Arquivar
                    </button>
                  ) : null}
                  {selectedCadastro.canDelete ? (
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busy === 'delete-cadastro'}
                      onClick={() => {
                        if (window.confirm('Excluir logicamente este cadastro?')) {
                          void runAction('delete-cadastro', handleDelete);
                        }
                      }}
                    >
                      Excluir
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="subpanel">
              <div className="panel-heading">
                <div>
                  <h3>Historico de indicacoes</h3>
                  <p className="muted">Empresas relacionadas, status e datas operacionais.</p>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Status</th>
                      <th>Envio</th>
                      <th>Contrato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCadastro.indicacoes.length ? (
                      selectedCadastro.indicacoes.map((indicacao) => (
                        <tr key={indicacao.id}>
                          <td className="stack">
                            <strong>{indicacao.empresaNome ?? indicacao.empresaSourceId}</strong>
                            <span className="muted">{indicacao.empresaSourceId}</span>
                            {indicacao.closedReason ? <span className="muted">{indicacao.closedReason}</span> : null}
                          </td>
                          <td>{formatIndicacaoStatus(indicacao.status)}</td>
                          <td>{formatDateTime(indicacao.sentAt)}</td>
                          <td>{formatDateTime(indicacao.contractGeneratedAt)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="muted">
                          Nenhuma indicacao registrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : (
          <section className="table-panel">
            <p className="muted">Selecione um cadastro para ver detalhes e operar o fluxo.</p>
          </section>
        )}
      </section>
    </div>
  );
}
