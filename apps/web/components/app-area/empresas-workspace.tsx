'use client';

import { startTransition, useEffect, useState } from 'react';
import type {
  AppCompanyDetail,
  AppCompanyIndicacaoItem,
  AppCompanyListItem,
  AppMatriculaListItem,
  CadastroListItem,
  PaginatedResponse,
} from '@financial-martec/contracts';
import { apiClientFetch } from '@/lib/client-api';
import {
  formatCadastroStatus,
  formatDateTime,
  formatIndicacaoStatus,
} from './format';

type EmpresasWorkspaceProps = {
  initialCompanies: PaginatedResponse<AppCompanyListItem>;
  initialCompany: AppCompanyDetail | null;
  initialMatriculados: PaginatedResponse<AppMatriculaListItem>;
  initialIndicacoes: AppCompanyIndicacaoItem[];
  initialCadastrosOptions: PaginatedResponse<CadastroListItem>;
  canManageIndicacoes: boolean;
};

type CompanyTab = 'visao-geral' | 'matriculados' | 'indicacoes';

const defaultCompaniesQuery = 'page=1&pageSize=20';
const defaultMatriculadosQuery = 'page=1&pageSize=20';

export function EmpresasWorkspace({
  initialCompanies,
  initialCompany,
  initialMatriculados,
  initialIndicacoes,
  initialCadastrosOptions,
  canManageIndicacoes,
}: EmpresasWorkspaceProps) {
  const [companiesPage, setCompaniesPage] = useState(initialCompanies);
  const [selectedSourceId, setSelectedSourceId] = useState(
    initialCompany?.sourceId ?? initialCompanies.items[0]?.sourceId ?? '',
  );
  const [selectedCompany, setSelectedCompany] = useState<AppCompanyDetail | null>(initialCompany);
  const [matriculadosPage, setMatriculadosPage] = useState(initialMatriculados);
  const [indicacoes, setIndicacoes] = useState(initialIndicacoes);
  const [cadastrosOptions, setCadastrosOptions] = useState(initialCadastrosOptions);
  const [activeTab, setActiveTab] = useState<CompanyTab>('visao-geral');
  const [companyQuery, setCompanyQuery] = useState(defaultCompaniesQuery);
  const [matriculasQuery, setMatriculasQuery] = useState(defaultMatriculadosQuery);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSourceId) {
      setSelectedCompany(null);
      return;
    }

    void loadCompanyBundle(selectedSourceId);
  }, [selectedSourceId]);

  async function loadCompanyBundle(sourceId: string, nextMatriculasQuery = matriculasQuery) {
    try {
      const [companyResponse, matriculadosResponse, indicacoesResponse] = await Promise.all([
        apiClientFetch(`/v1/app/empresas/${sourceId}`, { method: 'GET', headers: {} }),
        apiClientFetch(`/v1/app/empresas/${sourceId}/matriculados?${nextMatriculasQuery}`, {
          method: 'GET',
          headers: {},
        }),
        apiClientFetch(`/v1/app/empresas/${sourceId}/indicacoes`, { method: 'GET', headers: {} }),
      ]);

      const [companyPayload, matriculadosPayload, indicacoesPayload] = await Promise.all([
        companyResponse.json() as Promise<AppCompanyDetail>,
        matriculadosResponse.json() as Promise<PaginatedResponse<AppMatriculaListItem>>,
        indicacoesResponse.json() as Promise<AppCompanyIndicacaoItem[]>,
      ]);

      startTransition(() => {
        setSelectedCompany(companyPayload);
        setMatriculadosPage(matriculadosPayload);
        setIndicacoes(indicacoesPayload);
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar empresa.');
    }
  }

  async function reloadCompanies(nextQuery = companyQuery, nextSelectedSourceId?: string) {
    const response = await apiClientFetch(`/v1/app/empresas?${nextQuery}`, {
      method: 'GET',
      headers: {},
    });
    const payload = (await response.json()) as PaginatedResponse<AppCompanyListItem>;

    startTransition(() => {
      setCompaniesPage(payload);
      setCompanyQuery(nextQuery);
      const resolvedSelectedSourceId =
        nextSelectedSourceId && payload.items.some((item) => item.sourceId === nextSelectedSourceId)
          ? nextSelectedSourceId
          : payload.items[0]?.sourceId ?? '';
      setSelectedSourceId(resolvedSelectedSourceId);
    });
  }

  async function searchCadastros(search: string) {
    const params = new URLSearchParams({
      page: '1',
      pageSize: '20',
    });
    if (search.trim()) {
      params.set('search', search.trim());
    }

    const response = await apiClientFetch(`/v1/app/cadastros?${params.toString()}`, {
      method: 'GET',
      headers: {},
    });
    const payload = (await response.json()) as PaginatedResponse<CadastroListItem>;

    startTransition(() => {
      setCadastrosOptions(payload);
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

  async function handleFilterCompanies(formData: FormData) {
    const params = new URLSearchParams({
      page: '1',
      pageSize: '20',
    });
    const search = String(formData.get('search') ?? '').trim();
    if (search) {
      params.set('search', search);
    }
    if (formData.get('hasOpenIndicacoes') === 'on') {
      params.set('hasOpenIndicacoes', 'true');
    }

    await reloadCompanies(params.toString());
  }

  async function handleFilterMatriculados(formData: FormData) {
    if (!selectedSourceId) {
      return;
    }

    const params = new URLSearchParams({
      page: '1',
      pageSize: '20',
    });
    const search = String(formData.get('matriculaSearch') ?? '').trim();
    const turmaSourceId = String(formData.get('turmaSourceId') ?? '').trim();

    if (search) {
      params.set('search', search);
    }
    if (turmaSourceId) {
      params.set('turmaSourceId', turmaSourceId);
    }

    setMatriculasQuery(params.toString());
    await loadCompanyBundle(selectedSourceId, params.toString());
  }

  async function handleSearchCadastros(formData: FormData) {
    await searchCadastros(String(formData.get('cadastroSearch') ?? ''));
  }

  async function handleCreateIndicacao(formData: FormData) {
    if (!selectedSourceId) {
      return;
    }

    const cadastroId = String(formData.get('cadastroId') ?? '');
    await apiClientFetch(`/v1/app/cadastros/${cadastroId}/indicacoes`, {
      method: 'POST',
      body: JSON.stringify({
        empresaSourceId: selectedSourceId,
      }),
    });

    await loadCompanyBundle(selectedSourceId);
    await reloadCompanies(companyQuery, selectedSourceId);
    setFeedback('Indicacao criada para a empresa.');
  }

  async function handleIndicacaoAction(action: 'accept' | 'reject' | 'contract', indicacaoId: string) {
    if (!selectedSourceId) {
      return;
    }

    await apiClientFetch(`/v1/app/indicacoes/${indicacaoId}/${action}`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });

    await loadCompanyBundle(selectedSourceId);
    await reloadCompanies(companyQuery, selectedSourceId);
    setFeedback('Indicacao atualizada.');
  }

  return (
    <div className="admin-grid">
      <section className="table-panel">
        <div className="panel-heading">
          <div>
            <h3>Empresas</h3>
            <p className="muted">Consulta do parceiro e operacao contextual das indicacoes locais.</p>
          </div>
          <span className="status-pill">{companiesPage.total} empresas</span>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {feedback ? <p className="success-text">{feedback}</p> : null}

        <div className="table-toolbar">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              void runAction('filter-companies', () => handleFilterCompanies(formData));
            }}
          >
            <input name="search" placeholder="Buscar por empresa ou CNPJ" />
            <label className="check-item">
              <input type="checkbox" name="hasOpenIndicacoes" />
              <span>Somente com indicacoes abertas</span>
            </label>
            <button className="secondary-button" type="submit" disabled={busy === 'filter-companies'}>
              Filtrar
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void runAction('reset-companies', () => reloadCompanies(defaultCompaniesQuery))}
            >
              Limpar
            </button>
          </form>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Matriculados</th>
                <th>Indicacoes abertas</th>
                <th>Sync</th>
              </tr>
            </thead>
            <tbody>
              {companiesPage.items.length ? (
                companiesPage.items.map((company) => (
                  <tr
                    key={company.sourceId}
                    className="clickable-row"
                    data-active={selectedSourceId === company.sourceId}
                    onClick={() => setSelectedSourceId(company.sourceId)}
                  >
                    <td className="stack">
                      <strong>{company.name}</strong>
                      <span className="muted">{company.taxId ?? company.sourceId}</span>
                    </td>
                    <td>{company.totalMatriculados}</td>
                    <td>{company.totalIndicacoesAbertas}</td>
                    <td>{formatDateTime(company.lastSyncedAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="muted">
                    Nenhuma empresa no snapshot atual do pedagogico. Execute a sincronizacao no backoffice para popular esta tela.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedCompany ? (
        <section className="table-panel">
          <div className="panel-heading">
            <div>
              <h3>{selectedCompany.name}</h3>
              <p className="muted">{selectedCompany.legalName ?? selectedCompany.taxId ?? selectedCompany.sourceId}</p>
            </div>
            <span className="status-pill">{selectedCompany.totalMatriculados} matriculados</span>
          </div>

          <div className="tab-row">
            <button
              className="tab-button"
              type="button"
              data-active={activeTab === 'visao-geral'}
              onClick={() => setActiveTab('visao-geral')}
            >
              Visao geral
            </button>
            <button
              className="tab-button"
              type="button"
              data-active={activeTab === 'matriculados'}
              onClick={() => setActiveTab('matriculados')}
            >
              Matriculados
            </button>
            <button
              className="tab-button"
              type="button"
              data-active={activeTab === 'indicacoes'}
              onClick={() => setActiveTab('indicacoes')}
            >
              Cadastros indicados
            </button>
          </div>

          {activeTab === 'visao-geral' ? (
            <div className="admin-stack">
              <div className="detail-grid">
                <div className="detail-card">
                  <span className="detail-label">Contato</span>
                  <strong>{selectedCompany.email ?? selectedCompany.phone ?? '-'}</strong>
                </div>
                <div className="detail-card">
                  <span className="detail-label">Endereco</span>
                  <strong>{selectedCompany.address ?? '-'}</strong>
                </div>
                <div className="detail-card">
                  <span className="detail-label">Responsavel</span>
                  <strong>{selectedCompany.representativeName ?? '-'}</strong>
                </div>
                <div className="detail-card">
                  <span className="detail-label">Indicacoes abertas</span>
                  <strong>{selectedCompany.totalIndicacoesAbertas}</strong>
                </div>
              </div>

              <div className="subpanel">
                <div className="panel-heading">
                  <div>
                    <h3>Indicacoes por status</h3>
                    <p className="muted">Consolidado local por situacao operacional.</p>
                  </div>
                </div>
                <div className="detail-grid">
                  {Object.entries(selectedCompany.indicacoesPorStatus).length ? (
                    Object.entries(selectedCompany.indicacoesPorStatus).map(([status, total]) => (
                      <div key={status} className="detail-card">
                        <span className="detail-label">{formatIndicacaoStatus(status)}</span>
                        <strong>{total}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="muted">Nenhuma indicacao local registrada para esta empresa.</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'matriculados' ? (
            <div className="admin-stack">
              <div className="table-toolbar">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    void runAction('filter-matriculados-company', () => handleFilterMatriculados(formData));
                  }}
                >
                  <input name="matriculaSearch" placeholder="Buscar matriculados por nome ou CPF" />
                  <input name="turmaSourceId" placeholder="Filtrar por ID da turma" />
                  <button
                    className="secondary-button"
                    type="submit"
                    disabled={busy === 'filter-matriculados-company'}
                  >
                    Filtrar
                  </button>
                </form>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Aluno</th>
                      <th>Turma</th>
                      <th>Situacao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matriculadosPage.items.length ? (
                      matriculadosPage.items.map((matricula) => (
                        <tr key={matricula.sourceId}>
                          <td className="stack">
                            <strong>{matricula.nome}</strong>
                            <span className="muted">{matricula.cpf}</span>
                          </td>
                          <td>{matricula.turma?.name ?? '-'}</td>
                          <td>{matricula.situacao}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="muted">
                          Nenhum matriculado encontrado para esta empresa.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {activeTab === 'indicacoes' ? (
            <div className="admin-stack">
              {canManageIndicacoes ? (
                <section className="subpanel">
                  <div className="panel-heading">
                    <div>
                      <h3>Indicar cadastro</h3>
                      <p className="muted">Mostre os cadastros locais elegiveis e envie para esta empresa.</p>
                    </div>
                  </div>

                  <form
                    className="form-grid"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      void runAction('search-company-cadastros', () => handleSearchCadastros(formData));
                    }}
                  >
                    <div className="field">
                      <label htmlFor="cadastroSearch">Buscar cadastros</label>
                      <input id="cadastroSearch" name="cadastroSearch" placeholder="Nome, CPF ou responsavel" />
                    </div>
                    <button className="secondary-button" type="submit" disabled={busy === 'search-company-cadastros'}>
                      Buscar
                    </button>
                  </form>

                  <form
                    className="form-grid"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      void runAction('create-company-indicacao', () => handleCreateIndicacao(formData));
                    }}
                  >
                    <div className="field">
                      <label htmlFor="cadastroId">Cadastro</label>
                      <select id="cadastroId" name="cadastroId" defaultValue="">
                        <option value="">Selecione um cadastro</option>
                        {cadastrosOptions.items
                          .filter((cadastro) => !cadastro.deletedAt && cadastro.status !== 'MATRICULADO')
                          .map((cadastro) => (
                            <option key={cadastro.id} value={cadastro.id}>
                              {cadastro.nomeCompleto} ({cadastro.cpf})
                            </option>
                          ))}
                      </select>
                    </div>
                    <button className="secondary-button" type="submit" disabled={busy === 'create-company-indicacao'}>
                      Criar indicacao
                    </button>
                  </form>
                </section>
              ) : null}

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cadastro</th>
                      <th>Status indicacao</th>
                      <th>Status cadastro</th>
                      <th>Envio</th>
                      <th>Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indicacoes.length ? (
                      indicacoes.map((indicacao) => (
                        <tr key={indicacao.indicacaoId}>
                          <td className="stack">
                            <strong>{indicacao.cadastroNomeCompleto}</strong>
                            <span className="muted">{indicacao.cadastroCpf}</span>
                          </td>
                          <td>{formatIndicacaoStatus(indicacao.statusIndicacao)}</td>
                          <td>{formatCadastroStatus(indicacao.statusCadastro)}</td>
                          <td>{formatDateTime(indicacao.sentAt)}</td>
                          <td>
                            {canManageIndicacoes ? (
                              <div className="inline-actions">
                                <button
                                  className="secondary-button"
                                  type="button"
                                  disabled={busy === `accept-${indicacao.indicacaoId}`}
                                  onClick={() =>
                                    void runAction(`accept-${indicacao.indicacaoId}`, () =>
                                      handleIndicacaoAction('accept', indicacao.indicacaoId),
                                    )
                                  }
                                >
                                  Aceitar
                                </button>
                                <button
                                  className="secondary-button"
                                  type="button"
                                  disabled={busy === `reject-${indicacao.indicacaoId}`}
                                  onClick={() =>
                                    void runAction(`reject-${indicacao.indicacaoId}`, () =>
                                      handleIndicacaoAction('reject', indicacao.indicacaoId),
                                    )
                                  }
                                >
                                  Recusar
                                </button>
                                <button
                                  className="secondary-button"
                                  type="button"
                                  disabled={busy === `contract-${indicacao.indicacaoId}`}
                                  onClick={() =>
                                    void runAction(`contract-${indicacao.indicacaoId}`, () =>
                                      handleIndicacaoAction('contract', indicacao.indicacaoId),
                                    )
                                  }
                                >
                                  Contrato
                                </button>
                              </div>
                            ) : (
                              <span className="muted">Somente leitura</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="muted">
                          Nenhuma indicacao local para esta empresa.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="table-panel">
          <p className="muted">Selecione uma empresa para abrir a visao geral, matriculados e indicacoes.</p>
        </section>
      )}
    </div>
  );
}
