import type {
  AppCompanyListItem,
  CadastroDetail,
  CadastroListItem,
  PaginatedResponse,
} from '@financial-martec/contracts';
import { CadastrosWorkspace } from '@/components/app-area/cadastros-workspace';
import { apiFetchJson, requireScreen } from '@/lib/server-api';

export default async function CadastrosPage() {
  const { user } = await requireScreen('/app/cadastros', 'APP');

  const initialCadastros = await apiFetchJson<PaginatedResponse<CadastroListItem>>(
    '/v1/app/cadastros?page=1&pageSize=20',
  );
  const initialCadastro = initialCadastros.items[0]
    ? await apiFetchJson<CadastroDetail>(`/v1/app/cadastros/${initialCadastros.items[0].id}`)
    : null;
  const companyOptions = await apiFetchJson<PaginatedResponse<AppCompanyListItem>>(
    '/v1/app/empresas?page=1&pageSize=100',
  );

  return (
    <section className="content-stack">
      <div className="hero-panel">
        <span className="eyebrow">Area comum</span>
        <h2 className="auth-title">Cadastros locais</h2>
        <p className="auth-copy">
          Operacao inicial do candidato no financeiro, com status derivado por indicacoes.
        </p>
      </div>
      <CadastrosWorkspace
        initialCadastros={initialCadastros}
        initialCadastro={initialCadastro}
        companyOptions={companyOptions.items}
        canManage={user.permissions.includes('app.cadastros.manage')}
      />
    </section>
  );
}
