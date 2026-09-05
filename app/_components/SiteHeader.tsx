import { Logo } from './Logo';

// Shared announcement bar + nav. Presentation only.
export function SiteHeader() {
  return (
    <header>
      <div className="kc-ann">Fall 2026 enrollment closes soon</div>
      <div className="kc-wrap">
        <nav className="kc-nav">
          <a className="kc-brand" href="/"><Logo /> Keiki Coders</a>
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
