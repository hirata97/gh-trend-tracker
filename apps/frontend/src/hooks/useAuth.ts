/**
 * useAuth Hook
 * 認証状態を管理するカスタムフック
 * Related: fun-030 (GitHub OAuth認証)
 */

import { useState, useEffect, useCallback } from 'react';

export interface User {
  username: string;
  avatar_url?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
}

const API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL || 'http://localhost:8787';

/**
 * 認証状態を管理するカスタムフック
 */
export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
  });

  // 認証状態を確認する関数
  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        credentials: 'include', // Cookieを送信
      });

      if (response.ok) {
        const data = await response.json();
        setAuthState({
          isAuthenticated: true,
          user: {
            username: data.username,
            avatar_url: data.avatar_url,
          },
          isLoading: false,
        });
      } else {
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
        });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to check auth status:', error);
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });
    }
  }, []);

  // 初回マウント時に認証状態を確認
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // ログイン処理
  const login = useCallback(() => {
    window.location.href = `${API_BASE_URL}/api/auth/login/github`;
  }, []);

  // ログアウト処理
  const logout = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
        });
        window.location.href = '/';
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to logout:', error);
    }
  }, []);

  return {
    ...authState,
    login,
    logout,
    checkAuth,
  };
}
