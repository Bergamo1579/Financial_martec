import { apiFetch, requireUser } from '@/lib/server-api';

async function getCounts() {
  const [companiesResponse, studentsResponse] = await Promise.all([
    apiFetch('/v1/empresas?take=5'),
    apiFetch('/v1/alunos?take=5'),
  ]);

  const companies = companiesResponse.ok ? ((await companiesResponse.json()) as Array<unknown>) : [];
  const students = studentsResponse.ok ? ((await studentsResponse.json()) as Array<unknown>) : [];

  return {
    companies: companies.length,
    students: students.length,
  };
}

export default async function DashboardPage() {
  const user = await requireUser();
  const counts = await getCounts();

  return (
    <div className="page-shell">
      <section className="hero-panel">
        <span className="eyebrow">Visão técnica</span>
        <h2 className="shell-title">Estrutura pronta para auth, auditoria e reconciliação diária.</h2>
        <p className="shell-copy">
          Sessão ativa para {user.name} com papéis {user.roles.join(', ')}.
        </p>
      </section>

      <section className="metrics-grid">
        <article className="metric-card">
          <span className="muted">Empresas em snapshot</span>
          <strong>{counts.companies}</strong>
          <p className="muted">Contagem inicial baseada na projeção local.</p>
        </article>

        <article className="metric-card">
          <span className="muted">Alunos em snapshot</span>
          <strong>{counts.students}</strong>
          <p className="muted">Pronto para consultas administrativas e auditoria de leitura.</p>
        </article>
      </section>
    </div>
  );
}
