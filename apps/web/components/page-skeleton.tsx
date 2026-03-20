export function PageSkeleton() {
  return (
    <section className="content-stack">
      <div className="hero-panel">
        <span className="skeleton skeleton-line" style={{ width: '6rem' }} />
        <span className="skeleton skeleton-line" style={{ width: '14rem', height: '1.2rem' }} />
        <span className="skeleton skeleton-line" style={{ width: '22rem' }} />
      </div>

      <div className="metrics-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="metric-card">
            <span className="skeleton skeleton-line" style={{ width: '5rem' }} />
            <span className="skeleton skeleton-line" style={{ width: '3rem', height: '1.6rem' }} />
          </div>
        ))}
      </div>

      <div className="table-panel">
        <span className="skeleton skeleton-block" />
        <span className="skeleton skeleton-block" />
        <span className="skeleton skeleton-block" />
      </div>
    </section>
  );
}
