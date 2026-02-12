/**
 * UserMenu Component
 * ログイン後のユーザーメニュー表示
 * Related: fun-030 (GitHub OAuth認証)
 */

import { useState, useRef, useEffect } from 'react';
import type { User } from '../hooks/useAuth';

interface UserMenuProps {
  user: User;
  onLogout: () => void;
}

export default function UserMenu({ user, onLogout }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-menu__trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {user.avatar_url && (
          <img
            src={user.avatar_url}
            alt={user.username}
            className="user-menu__avatar"
          />
        )}
        <span className="user-menu__username">{user.username}</span>
        <svg
          className={`user-menu__chevron ${isOpen ? 'user-menu__chevron--open' : ''}`}
          width="12"
          height="8"
          viewBox="0 0 12 8"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1 1L6 6L11 1"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="user-menu__dropdown">
          <a href="/mypage" className="user-menu__item">
            マイページ
          </a>
          <a href="/favorites" className="user-menu__item">
            お気に入り
          </a>
          <hr className="user-menu__divider" />
          <button onClick={onLogout} className="user-menu__item user-menu__item--logout">
            ログアウト
          </button>
        </div>
      )}
    </div>
  );
}
