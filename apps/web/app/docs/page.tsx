import type { Metadata } from 'next';
import Link from 'next/link';
import { resolvePublicApiBaseUrl } from '@/lib/api-base-url';
import {
  documentationEndpoints,
  documentationHighlights,
  documentationLinks,
  documentationSections,
  documentationSignals,
} from '@/lib/documentation';
import { DocsNav } from './docs-nav';
import styles from './docs.module.css';

export const metadata: Metadata = {
  title: 'Documentacao | Financial Martec',
  description: 'Portal de documentacao do sistema Financial Martec.',
};

const navItems = [
  { id: 'hero', label: 'Visao geral', group: 'Inicio' },
  ...documentationSections.map((s) => ({
    id: s.id,
    label: s.title,
    group: 'Secoes',
  })),
  { id: 'endpoints', label: 'Rotas da API', group: 'Referencia' },
  { id: 'api-reference', label: 'API e contratos', group: 'Referencia' },
  { id: 'roadmap', label: 'Proximos passos', group: 'Roadmap' },
];

export default function DocumentationPage() {
  const apiBaseUrl = resolvePublicApiBaseUrl();

  return (
    <div className={styles.layout}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.brandRow}>
            <span className={styles.brand}>Financial Martec</span>
            <span className={styles.badge}>Docs</span>
          </div>
          <p className={styles.sidebarCaption}>
            Arquitetura, operacao e referencia da API.
          </p>
        </div>

        <DocsNav items={navItems} />

        <div className={styles.sidebarBottom}>
          <span className={styles.bottomLabel}>API Base</span>
          <code className={styles.bottomCode}>{apiBaseUrl}</code>
        </div>
      </aside>

      {/* ── Content ── */}
      <main className={styles.main}>
        {/* Hero */}
        <section id="hero" className={styles.hero}>
          <span className={styles.kicker}>Portal de documentacao</span>
          <h1 className={styles.heroTitle}>Documentacao viva<br />do sistema.</h1>
          <p className={styles.heroCopy}>
            Estado atual do produto, fluxos operacionais e acesso direto a API reference —
            tudo em um so lugar.
          </p>
          <div className={styles.heroActions}>
            <Link href="/docs/reference" className={styles.btnPrimary}>
              API Reference
            </Link>
            <Link href="/login" className={styles.btnGhost}>
              Backoffice
            </Link>
          </div>
        </section>

        {/* Metrics */}
        <div className={styles.metricsRow}>
          {documentationHighlights.map((h) => (
            <article key={h.label} className={styles.metricCard}>
              <span className={styles.metricLabel}>{h.label}</span>
              <strong className={styles.metricValue}>{h.value}</strong>
              <p className={styles.metricDesc}>{h.description}</p>
            </article>
          ))}
        </div>

        {/* Sections */}
        {documentationSections.map((section) => (
          <section key={section.id} id={section.id} className={styles.card}>
            <header className={styles.cardHead}>
              <span className={styles.kicker}>{section.kicker}</span>
              <h2 className={styles.cardTitle}>{section.title}</h2>
              <p className={styles.cardSummary}>{section.summary}</p>
            </header>
            <ul className={styles.bullets}>
              {section.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </section>
        ))}

        {/* Endpoints */}
        <section id="endpoints" className={styles.card}>
          <header className={styles.cardHead}>
            <span className={styles.kicker}>Rotas em destaque</span>
            <h2 className={styles.cardTitle}>Endpoints principais da API</h2>
            <p className={styles.cardSummary}>
              Rotas publicadas pelo backend que sustentam o backoffice e a integracao externa.
            </p>
          </header>
          <div className={styles.endpointList}>
            {documentationEndpoints.map((ep) => (
              <div key={`${ep.method}:${ep.path}`} className={styles.endpointRow}>
                <span className={`${styles.endpointMethod} ${styles[`method${ep.method}`] ?? ''}`}>
                  {ep.method}
                </span>
                <div className={styles.endpointBody}>
                  <code className={styles.endpointPath}>{ep.path}</code>
                  <span className={styles.endpointDetail}>{ep.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* API Reference links */}
        <section id="api-reference" className={styles.card}>
          <header className={styles.cardHead}>
            <span className={styles.kicker}>Referencia interativa</span>
            <h2 className={styles.cardTitle}>Rotas e contratos da API</h2>
            <p className={styles.cardSummary}>
              Scalar e OpenAPI no mesmo dominio do web — consulta direta e desacoplada.
            </p>
          </header>
          <div className={styles.linkGrid}>
            {documentationLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={styles.linkCard}
                target={l.external ? '_blank' : undefined}
                rel={l.external ? 'noreferrer' : undefined}
              >
                <strong className={styles.linkName}>{l.label}</strong>
                <code className={styles.linkHref}>{l.href}</code>
                <p className={styles.linkDetail}>{l.detail}</p>
              </a>
            ))}
          </div>
        </section>

        {/* Roadmap signals */}
        <section id="roadmap" className={styles.card}>
          <header className={styles.cardHead}>
            <span className={styles.kicker}>Roadmap</span>
            <h2 className={styles.cardTitle}>Proximos passos do produto</h2>
            <p className={styles.cardSummary}>
              Quando o dominio financeiro entrar, este portal sera atualizado primeiro.
            </p>
          </header>
          <div className={styles.signalList}>
            {documentationSignals.map((s, i) => (
              <div key={s} className={styles.signalRow}>
                <span className={styles.signalNum}>{String(i + 1).padStart(2, '0')}</span>
                <p className={styles.signalText}>{s}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className={styles.pageFooter}>
          Financial Martec Documentation — 2026
        </footer>
      </main>
    </div>
  );
}
