/**
 * GlobalHeader Component (COM-002)
 * Site-wide header with navigation and snapshot date display.
 * Related: fun-014 (snapshot date display)
 */

interface GlobalHeaderProps {
  snapshotDate?: string;
  isAuthenticated?: boolean;
}

export default function GlobalHeader({ snapshotDate, isAuthenticated = false }: GlobalHeaderProps) {
  return (
    <header className="global-header">
      <div className="global-header__inner">
        <a href="/" className="global-header__logo">
          GitHub Trends Tracker
        </a>

        <nav className="global-header__nav">
          <a href="/" className="global-header__link">
            Trends
          </a>
        </nav>

        <div className="global-header__right">
          {snapshotDate && (
            <span className="global-header__snapshot" title="Latest data snapshot date">
              Data: {snapshotDate}
            </span>
          )}
          {isAuthenticated ? (
            <span className="global-header__auth">Logged in</span>
          ) : (
            <span className="global-header__auth global-header__auth--guest">Guest</span>
          )}
        </div>
      </div>
    </header>
  );
}
