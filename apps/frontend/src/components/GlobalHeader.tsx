/**
 * GlobalHeader Component (COM-002)
 * Site-wide header with navigation, search, and snapshot date display.
 * Related: fun-014 (snapshot date display), fun-015 (repository search input), fun-030 (GitHub OAuth認証)
 */

import { useCallback } from 'react';
import SearchInput from './SearchInput';
import AuthButton from './AuthButton';
import { useAuth } from '../hooks/useAuth';

interface GlobalHeaderProps {
  snapshotDate?: string;
}

export default function GlobalHeader({ snapshotDate }: GlobalHeaderProps) {
  const { isAuthenticated, user, login, logout } = useAuth();

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
            日次トレンド
          </a>
          <a href="/weekly" className="global-header__link">
            週別トレンド
          </a>
          <a href="/favorites" className="global-header__link">
            お気に入り
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
          <AuthButton
            isAuthenticated={isAuthenticated}
            user={user}
            onLogin={login}
            onLogout={logout}
          />
        </div>
      </div>
    </header>
  );
}
