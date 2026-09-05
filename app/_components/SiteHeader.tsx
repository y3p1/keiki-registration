// Shared announcement bar + nav. Presentation only.
export function SiteHeader() {
  return (
    <header>
      <div className="kc-ann">Enroll for Fall 2026 — registration closing soon 🌺</div>
      <div className="kc-wrap">
        <nav className="kc-nav">
          <a className="kc-brand" href="/">🐢 Keiki Coders</a>
          <div className="kc-links">
            <a className="kc-link" href="/register">Register</a>
            <a className="kc-link" href="/my">My registrations</a>
            <a className="kc-link" href="/staff">Staff</a>
          </div>
        </nav>
      </div>
    </header>
  );
}
