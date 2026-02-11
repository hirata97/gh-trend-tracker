/**
 * GlobalHeader Component (COM-002)
 * Site-wide header with navigation, search, and snapshot date display.
 * Related: fun-014 (snapshot date display), fun-015 (repository search input)
 */

import { useCallback } from 'react';
import SearchInput from './SearchInput';

interface GlobalHeaderProps {
  snapshotDate?: string;
  isAuthenticated?: boolean;
}

export default function GlobalHeader({ snapshotDate, isAuthenticated = false }: GlobalHeaderProps) {
  const handleSearch = useCallback((query: string) => {
    // Navigate to search results page
    window.location.href = `/search?q=${encodeURIComponent(query)}`;
  }, []);

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
          <a href="/favorites" className="global-header__link">
            Favorites
          </a>
        </nav>

        <div className="global-header__search">
          <SearchInput onSearch={handleSearch} placeholder="Search repositories..." />
        </div>

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
