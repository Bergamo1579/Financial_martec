import type {
  PaginatedResponse,
  PlanoPagamentoDetail,
  PlanoPagamentoListItem,
} from '@financial-martec/contracts';
import { PlanosPagamentoWorkspace } from '@/components/app-area/planos-pagamento-workspace';
import { apiFetchJson, requireScreen } from '@/lib/server-api';

export default async function PlanosPagamentoPage() {
  const { user } = await requireScreen('/app/planos-pagamento', 'APP');

  const initialPlanos = await apiFetchJson<PaginatedResponse<PlanoPagamentoListItem>>(
    '/v1/app/planos-pagamento?page=1&pageSize=20',
  );
  const initialPlano = initialPlanos.items[0]
    ? await apiFetchJson<PlanoPagamentoDetail>(
        `/v1/app/planos-pagamento/${initialPlanos.items[0].id}`,
      )
    : null;

  return (
    <section className="content-stack">
      <div className="hero-panel">
        <span className="eyebrow">Area comum</span>
        <h2 className="auth-title">Planos de pagamento</h2>
        <p className="auth-copy">
          Catalogo comercial local que prepara a futura relacao entre matricula e empresa.
        </p>
      </div>
      <PlanosPagamentoWorkspace
        initialPlanos={initialPlanos}
        initialPlano={initialPlano}
        canManage={user.permissions.includes('app.planos-pagamento.manage')}
      />
    </section>
  );
}
