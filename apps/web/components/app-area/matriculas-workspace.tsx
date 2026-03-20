'use client';

import { startTransition, useEffect, useState } from 'react';
import type {
  AppCompanyListItem,
  AppMatriculaDetail,
  AppMatriculaListItem,
  PaginatedResponse,
} from '@financial-martec/contracts';
import { apiClientFetch } from '@/lib/client-api';
import { formatDate, formatDateTime } from './format';

type MatriculasWorkspaceProps = {
  initialMatriculas: PaginatedResponse<AppMatriculaListItem>;
  initialMatricula: AppMatriculaDetail | null;
  companyOptions: AppCompanyListItem[];
};

const defaultListQuery = 'page=1&pageSize=20';

export function MatriculasWorkspace({
  initialMatriculas,
  initialMatricula,
  companyOptions,
}: MatriculasWorkspaceProps) {
  const [matriculasPage, setMatriculasPage] = useState(initialMatriculas);
  const [selectedSourceId, setSelectedSourceId] = useState(
    initialMatricula?.sourceId ?? initialMatriculas.items[0]?.sourceId ?? '',
  );
  const [selectedMatricula, setSelectedMatricula] = useState<AppMatriculaDetail | null>(initialMatricula);
  const [activeQuery, setActiveQuery] = useState(defaultListQuery);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSourceId) {
      setSelectedMatricula(null);
      return;
    }

    void loadMatricula(selectedSourceId);
  }, [selectedSourceId]);

  async function loadMatricula(sourceId: string) {
    try {
      const response = await apiClientFetch(`/v1/app/matriculas/${sourceId}`, {
        method: 'GET',
        headers: {},
      });
      const payload = (await response.json()) as AppMatriculaDetail;
      startTransition(() => {
        setSelectedMatricula(payload);
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar matricula.');
    }
  }

  async function reloadMatriculas(queryString = activeQuery, nextSourceId?: string) {
    const response = await apiClientFetch(`/v1/app/matriculas?${queryString}`, {
      method: 'GET',
      headers: {},
    });
    const payload = (await response.json()) as PaginatedResponse<AppMatriculaListItem>;

    startTransition(() => {
      setMatriculasPage(payload);
      setActiveQuery(queryString);
      const resolvedSelectedSourceId =
        nextSourceId && payload.items.some((item) => item.sourceId === nextSourceId)
          ? nextSourceId
          : payload.items[0]?.sourceId ?? '';
      setSelectedSourceId(resolvedSelectedSourceId);
    });
  }

  async function runAction(actionKey: string, action: () => Promise<void>) {
    setBusy(actionKey);
    setError(null);

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
    const empresaSourceId = String(formData.get('empresaSourceId') ?? '').trim();
    const turmaSourceId = String(formData.get('turmaSourceId') ?? '').trim();

    if (search) {
      params.set('search', search);
    }
    if (empresaSourceId) {
      params.set('empresaSourceId', empresaSourceId);
    }
    if (turmaSourceId) {
      params.set('turmaSourceId', turmaSourceId);
    }

    await reloadMatriculas(params.toString());
  }

  return (
    <div className="admin-grid">
      <section className="table-panel">
        <div className="panel-heading">
          <div>
            <h3>Matriculas</h3>
            <p className="muted">Base read-only de alunos ja matriculados no pedagogico.</p>
          </div>
          <span className="status-pill">{matriculasPage.total} alunos</span>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="table-toolbar">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              void runAction('filter-matriculas', () => handleFilter(formData));
            }}
          >
            <input name="search" placeholder="Buscar por nome ou CPF" />
            <select name="empresaSourceId" defaultValue="">
              <option value="">Todas as empresas</option>
              {companyOptions.map((company) => (
                <option key={company.sourceId} value={company.sourceId}>
                  {company.name}
                </option>
              ))}
            </select>
            <input name="turmaSourceId" placeholder="Filtrar por ID da turma" />
            <button className="secondary-button" type="submit" disabled={busy === 'filter-matriculas'}>
              Filtrar
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void runAction('reset-matriculas', () => reloadMatriculas(defaultListQuery))}
            >
              Limpar
            </button>
          </form>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Empresa</th>
                <th>Turma</th>
                <th>Sync</th>
              </tr>
            </thead>
            <tbody>
              {matriculasPage.items.length ? (
                matriculasPage.items.map((matricula) => (
                  <tr
                    key={matricula.sourceId}
                    className="clickable-row"
                    data-active={selectedSourceId === matricula.sourceId}
                    onClick={() => setSelectedSourceId(matricula.sourceId)}
                  >
                    <td className="stack">
                      <strong>{matricula.nome}</strong>
                      <span className="muted">{matricula.cpf}</span>
                    </td>
                    <td>{matricula.empresa?.name ?? '-'}</td>
                    <td>{matricula.turma?.name ?? '-'}</td>
                    <td>{formatDateTime(matricula.lastSyncedAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="muted">
                    Nenhuma matricula no snapshot atual do pedagogico. Execute a sincronizacao no backoffice para carregar os dados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedMatricula ? (
        <section className="table-panel">
          <div className="panel-heading">
            <div>
              <h3>{selectedMatricula.nome}</h3>
              <p className="muted">{selectedMatricula.sourceId}</p>
            </div>
            <span className="status-pill">{selectedMatricula.situacao}</span>
          </div>

          <div className="detail-grid">
            <div className="detail-card">
              <span className="detail-label">CPF</span>
              <strong>{selectedMatricula.cpf}</strong>
            </div>
            <div className="detail-card">
              <span className="detail-label">Empresa</span>
              <strong>{selectedMatricula.empresa?.name ?? '-'}</strong>
            </div>
            <div className="detail-card">
              <span className="detail-label">Turma</span>
              <strong>{selectedMatricula.turma?.name ?? '-'}</strong>
            </div>
            <div className="detail-card">
              <span className="detail-label">Unidade</span>
              <strong>{selectedMatricula.unidade?.name ?? '-'}</strong>
            </div>
          </div>

          <div className="subpanel">
            <div className="panel-heading">
              <div>
                <h3>Dados do aluno</h3>
                <p className="muted">Leitura consolidada do backend financeiro sobre o snapshot pedagogico.</p>
              </div>
            </div>

            <div className="detail-grid">
              <div className="detail-card">
                <span className="detail-label">E-mail</span>
                <strong>{selectedMatricula.email ?? '-'}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">Telefone</span>
                <strong>{selectedMatricula.telefone ?? '-'}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">Nascimento</span>
                <strong>{formatDate(selectedMatricula.dataNascimento)}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">Responsavel</span>
                <strong>{selectedMatricula.nomeResponsavel ?? '-'}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">Escola</span>
                <strong>{selectedMatricula.escola ?? '-'}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">Serie</span>
                <strong>{selectedMatricula.serie ?? '-'}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">Periodo</span>
                <strong>{selectedMatricula.periodo ?? '-'}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">Ultimo sync</span>
                <strong>{formatDateTime(selectedMatricula.lastSyncedAt)}</strong>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="table-panel">
          <p className="muted">Selecione uma matricula para visualizar os dados consolidados.</p>
        </section>
      )}
    </div>
  );
}
