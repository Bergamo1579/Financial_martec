import type {
  AppCompanyListItem,
  AppMatriculaDetail,
  AppMatriculaListItem,
  PaginatedResponse,
} from '@financial-martec/contracts';
import { MatriculasWorkspace } from '@/components/app-area/matriculas-workspace';
import { apiFetchJson, requireScreen } from '@/lib/server-api';

export default async function MatriculasPage() {
  await requireScreen('/app/matriculas', 'APP');

  const initialMatriculas = await apiFetchJson<PaginatedResponse<AppMatriculaListItem>>(
    '/v1/app/matriculas?page=1&pageSize=20',
  );
  const initialMatricula = initialMatriculas.items[0]
    ? await apiFetchJson<AppMatriculaDetail>(
        `/v1/app/matriculas/${initialMatriculas.items[0].sourceId}`,
      )
    : null;
  const companyOptions = await apiFetchJson<PaginatedResponse<AppCompanyListItem>>(
    '/v1/app/empresas?page=1&pageSize=100',
  );

  return (
    <section className="content-stack">
      <div className="hero-panel">
        <span className="eyebrow">Area comum</span>
        <h2 className="auth-title">Matriculas read-only</h2>
        <p className="auth-copy">
          Base consolidada do pedagogico para consulta operacional confiavel.
        </p>
      </div>
      <MatriculasWorkspace
        initialMatriculas={initialMatriculas}
        initialMatricula={initialMatricula}
        companyOptions={companyOptions.items}
      />
    </section>
  );
}
