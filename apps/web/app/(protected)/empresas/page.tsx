import { apiFetch } from '@/lib/server-api';

async function getCompanies() {
  const response = await apiFetch('/v1/empresas?take=50');
  if (!response.ok) {
    return [];
  }

  return response.json() as Promise<
    Array<{
      sourceId: string;
      name: string;
      legalName?: string | null;
      taxId?: string | null;
      email?: string | null;
      phone?: string | null;
      lastSyncedAt: string;
    }>
  >;
}

export default async function CompaniesPage() {
  const companies = await getCompanies();

  return (
    <section className="table-panel">
      <div className="table-toolbar">
        <div>
          <span className="eyebrow">Read Model</span>
          <h2 style={{ margin: 0 }}>Empresas do pedagógico no contexto financeiro</h2>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Empresa</th>
            <th>Documento</th>
            <th>Contato</th>
            <th>Último sync</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.sourceId}>
              <td>
                <div className="stack">
                  <strong>{company.name}</strong>
                  <span className="muted">{company.legalName ?? 'Sem razão social'}</span>
                </div>
              </td>
              <td>{company.taxId ?? 'Sem CNPJ'}</td>
              <td>
                <div className="stack">
                  <span>{company.email ?? 'Sem e-mail'}</span>
                  <span className="muted">{company.phone ?? 'Sem telefone'}</span>
                </div>
              </td>
              <td>{new Date(company.lastSyncedAt).toLocaleString('pt-BR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
