import type { CompanyListItem, PaginatedResponse } from '@financial-martec/contracts';
import { apiFetchJson, requireScreen } from '@/lib/server-api';

export default async function BackofficeCompaniesPage() {
  const [, companies] = await Promise.all([
    requireScreen('/backoffice/empresas', 'BACKOFFICE'),
    apiFetchJson<PaginatedResponse<CompanyListItem>>('/v1/empresas?page=1&pageSize=50'),
  ]);

  return (
    <section className="content-stack">
      <div className="hero-panel">
        <span className="eyebrow">Empresas</span>
        <h2 className="auth-title">Leitura operacional de empresas.</h2>
        <p className="auth-copy">Snapshot atual vindo do fluxo de sincronizacao do pedagogico.</p>
      </div>

      <div className="table-panel">
        <div className="table-toolbar">
          <strong>{companies.total} registros</strong>
        </div>

        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Documento</th>
              <th>Contato</th>
              <th>Ultimo sync</th>
            </tr>
          </thead>
          <tbody>
            {companies.items.map((company) => (
              <tr key={company.sourceId}>
                <td className="stack">
                  <strong>{company.name}</strong>
                  <span className="muted">{company.legalName ?? 'Sem razao social'}</span>
                </td>
                <td>{company.taxId ?? 'Nao informado'}</td>
                <td className="stack">
                  <span>{company.email ?? 'Sem e-mail'}</span>
                  <span className="muted">{company.phone ?? 'Sem telefone'}</span>
                </td>
                <td>{new Date(company.lastSyncedAt).toLocaleString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
