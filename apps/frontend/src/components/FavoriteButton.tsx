/**
 * FavoriteButton Component
 * お気に入り登録/解除ボタン
 */

import React from 'react';

export interface FavoriteButtonProps {
  repo: { id: string; full_name: string };
  isFavorite: boolean;
  onToggle: (repo: { id: string; full_name: string }) => void;
  size?: 'small' | 'medium' | 'large';
}

export default function FavoriteButton({
  repo,
  isFavorite,
  onToggle,
  size = 'medium',
}: FavoriteButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault(); // リンククリックを防ぐ
    onToggle(repo);
  };

  const sizeClass = `favorite-button--${size}`;
  const activeClass = isFavorite ? 'favorite-button--active' : '';

  return (
    <button
      className={`favorite-button ${sizeClass} ${activeClass}`}
      onClick={handleClick}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      title={isFavorite ? 'お気に入りから削除' : 'お気に入りに追加'}
    >
      {isFavorite ? '★' : '☆'}
    </button>
  );
}
