'use client';

import { startTransition, useState } from 'react';
import type { DashboardSummary, SyncOverview } from '@financial-martec/contracts';
import { apiClientFetch } from '@/lib/client-api';

type BackofficeSyncPanelProps = {
  summary: DashboardSummary;
  initialOverview: SyncOverview | null;
  canManageSync: boolean;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return 'n/d';
  }

  return new Date(value).toLocaleString('pt-BR');
}

export function BackofficeSyncPanel({
  summary,
  initialOverview,
  canManageSync,
}: BackofficeSyncPanelProps) {
  const [overview, setOverview] = useState(initialOverview);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const snapshotEmpty = summary.totalCompanies === 0 && summary.totalStudents === 0;

  async function reloadOverview() {
    if (!canManageSync) {
      return;
    }

    const response = await apiClientFetch('/v1/sync/pedagogical/overview', {
      method: 'GET',
      headers: {},
    });
    const payload = (await response.json()) as SyncOverview;

    startTransition(() => {
      setOverview(payload);
    });
  }

  async function handleRunSync() {
    setBusy(true);
    setError(null);
    setFeedback(null);

    try {
      await apiClientFetch('/v1/sync/pedagogical/run', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await reloadOverview();
      setFeedback(
        'Sincronizacao enfileirada. O worker do projeto precisa estar online para executar o processamento.',
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Falha ao enfileirar a sincronizacao.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="table-panel">
      <div className="panel-heading">
        <div>
          <h3>Sync pedagogico</h3>
          <p className="muted">
            Estado do snapshot local consumido por empresas e matriculas na area comum.
          </p>
        </div>
        {canManageSync ? (
          <button className="secondary-button" type="button" onClick={() => void handleRunSync()} disabled={busy}>
            {busy ? 'Enfileirando...' : 'Sincronizar pedagogico'}
          </button>
        ) : null}
      </div>

      {snapshotEmpty ? (
        <p className="error-text">
          O snapshot atual do pedagogico esta vazio. Empresas e matriculas nao vao aparecer ate rodar a sincronizacao inicial.
        </p>
      ) : null}
      {error ? <p className="error-text">{error}</p> : null}
      {feedback ? <p className="success-text">{feedback}</p> : null}

      <div className="detail-grid">
        <div className="detail-card">
          <span className="detail-label">Empresas no snapshot</span>
          <strong>{summary.totalCompanies}</strong>
        </div>
        <div className="detail-card">
          <span className="detail-label">Matriculas no snapshot</span>
          <strong>{summary.totalStudents}</strong>
        </div>
        <div className="detail-card">
          <span className="detail-label">Ultimo status</span>
          <strong>{summary.lastSyncStatus ?? 'nenhum sync executado'}</strong>
        </div>
        <div className="detail-card">
          <span className="detail-label">Issues abertas</span>
          <strong>{overview?.openIssues ?? summary.openIssues}</strong>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <span className="detail-label">Ultima execucao</span>
          <strong>{formatDateTime(overview?.lastRun?.startedAt ?? summary.lastSyncAt)}</strong>
        </div>
        <div className="detail-card">
          <span className="detail-label">Ultima execucao com sucesso</span>
          <strong>{formatDateTime(overview?.lastSuccessfulRun?.finishedAt ?? summary.lastSuccessfulSyncAt)}</strong>
        </div>
        <div className="detail-card">
          <span className="detail-label">Execucao ativa</span>
          <strong>{overview?.activeRun?.status ?? 'nenhuma'}</strong>
        </div>
        <div className="detail-card">
          <span className="detail-label">Observacao</span>
          <strong>{canManageSync ? 'Botao acima enfileira o sync manual.' : 'Sem permissao para disparar sync.'}</strong>
        </div>
      </div>
    </section>
  );
}
