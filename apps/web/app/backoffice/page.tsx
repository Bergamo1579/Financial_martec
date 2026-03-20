import type { DashboardSummary, SyncOverview } from '@financial-martec/contracts';
import { BackofficeSyncPanel } from '@/components/backoffice-sync-panel';
import { apiFetchJson, requireScreen } from '@/lib/server-api';

export default async function BackofficeHomePage() {
  const { user } = await requireScreen('/backoffice', 'BACKOFFICE');
  const canManageSync = user.permissions.includes('sync.manage');
  const [summary, syncOverview] = await Promise.all([
    apiFetchJson<DashboardSummary>('/v1/dashboard/summary'),
    canManageSync ? apiFetchJson<SyncOverview>('/v1/sync/pedagogical/overview') : Promise.resolve(null),
  ]);

  return (
    <section className="content-stack">
      <div className="hero-panel">
        <span className="eyebrow">Backoffice</span>
        <h2 className="auth-title">Operacao central do sistema.</h2>
        <p className="auth-copy">
          Acompanhe o snapshot operacional e administre o acesso de usuarios e areas.
        </p>
      </div>

      <div className="metrics-grid">
        <article className="metric-card">
          <span className="muted">Empresas</span>
          <strong>{summary.totalCompanies}</strong>
        </article>
        <article className="metric-card">
          <span className="muted">Alunos</span>
          <strong>{summary.totalStudents}</strong>
        </article>
        <article className="metric-card">
          <span className="muted">Status do ultimo sync</span>
          <strong>{summary.lastSyncStatus ?? 'n/d'}</strong>
        </article>
        <article className="metric-card">
          <span className="muted">Issues abertas</span>
          <strong>{summary.openIssues}</strong>
        </article>
      </div>

      <BackofficeSyncPanel
        summary={summary}
        initialOverview={syncOverview}
        canManageSync={canManageSync}
      />
    </section>
  );
}
