/**
 * useFavorites Hook
 * ローカルストレージを使ったお気に入り管理フック
 */

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'gh-trend-tracker:favorites';

export interface FavoriteItem {
  repoId: string;
  fullName: string;
  addedAt: string; // ISO 8601
}

export interface UseFavoritesReturn {
  favorites: FavoriteItem[];
  isFavorite: (repoId: string) => boolean;
  addFavorite: (repo: { id: string; full_name: string }) => void;
  removeFavorite: (repoId: string) => void;
  toggleFavorite: (repo: { id: string; full_name: string }) => void;
}

/**
 * ローカルストレージからお気に入りリストを取得
 */
function loadFavorites(): FavoriteItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as FavoriteItem[];
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load favorites from localStorage:', error);
    return [];
  }
}

/**
 * ローカルストレージにお気に入りリストを保存
 */
function saveFavorites(favorites: FavoriteItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save favorites to localStorage:', error);
  }
}

export function useFavorites(): UseFavoritesReturn {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  // 初期化: ローカルストレージから読み込み
  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  // お気に入りかどうかをチェック
  const isFavorite = (repoId: string): boolean => {
    return favorites.some((fav) => fav.repoId === repoId);
  };

  // お気に入りに追加
  const addFavorite = (repo: { id: string; full_name: string }): void => {
    if (isFavorite(repo.id)) return;

    const newFavorite: FavoriteItem = {
      repoId: repo.id,
      fullName: repo.full_name,
      addedAt: new Date().toISOString(),
    };

    const updated = [...favorites, newFavorite];
    setFavorites(updated);
    saveFavorites(updated);
  };

  // お気に入りから削除
  const removeFavorite = (repoId: string): void => {
    const updated = favorites.filter((fav) => fav.repoId !== repoId);
    setFavorites(updated);
    saveFavorites(updated);
  };

  // お気に入りをトグル
  const toggleFavorite = (repo: { id: string; full_name: string }): void => {
    if (isFavorite(repo.id)) {
      removeFavorite(repo.id);
    } else {
      addFavorite(repo);
    }
  };

  return {
    favorites,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
  };
}
