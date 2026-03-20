import type {
  AppCompanyDetail,
  AppCompanyIndicacaoItem,
  AppCompanyListItem,
  AppMatriculaListItem,
  CadastroListItem,
  PaginatedResponse,
} from '@financial-martec/contracts';
import { EmpresasWorkspace } from '@/components/app-area/empresas-workspace';
import { apiFetchJson, requireScreen } from '@/lib/server-api';

export default async function EmpresasPage() {
  const { user } = await requireScreen('/app/empresas', 'APP');

  const initialCompanies = await apiFetchJson<PaginatedResponse<AppCompanyListItem>>(
    '/v1/app/empresas?page=1&pageSize=20',
  );
  const firstCompanySourceId = initialCompanies.items[0]?.sourceId;
  const [initialCompany, initialMatriculados, initialIndicacoes, initialCadastrosOptions] =
    firstCompanySourceId
      ? await Promise.all([
          apiFetchJson<AppCompanyDetail>(`/v1/app/empresas/${firstCompanySourceId}`),
          apiFetchJson<PaginatedResponse<AppMatriculaListItem>>(
            `/v1/app/empresas/${firstCompanySourceId}/matriculados?page=1&pageSize=20`,
          ),
          apiFetchJson<AppCompanyIndicacaoItem[]>(
            `/v1/app/empresas/${firstCompanySourceId}/indicacoes`,
          ),
          apiFetchJson<PaginatedResponse<CadastroListItem>>('/v1/app/cadastros?page=1&pageSize=20'),
        ])
      : [
          null,
          { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 },
          [],
          { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 },
        ];

  return (
    <section className="content-stack">
      <div className="hero-panel">
        <span className="eyebrow">Area comum</span>
        <h2 className="auth-title">Empresas e indicacoes</h2>
        <p className="auth-copy">
          Snapshot do pedagogico combinado com o fluxo local de indicacoes do financeiro.
        </p>
      </div>
      <EmpresasWorkspace
        initialCompanies={initialCompanies}
        initialCompany={initialCompany}
        initialMatriculados={initialMatriculados}
        initialIndicacoes={initialIndicacoes}
        initialCadastrosOptions={initialCadastrosOptions}
        canManageIndicacoes={user.permissions.includes('app.empresas.manage-indicacoes')}
      />
    </section>
  );
}
