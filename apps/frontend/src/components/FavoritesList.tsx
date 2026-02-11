/**
 * FavoritesList Component
 * お気に入りリポジトリの一覧表示
 */

import { useFavorites, type FavoriteItem } from '../hooks/useFavorites';
import RepositoryListItem from './RepositoryListItem';

interface FavoritesListProps {
  favorites: FavoriteItem[];
}

export default function FavoritesList({ favorites: _favorites }: FavoritesListProps) {
  const { favorites } = useFavorites();

  if (favorites.length === 0) {
    return (
      <div className="favorites-empty">
        <p className="favorites-empty__message">お気に入りがまだありません</p>
        <p className="favorites-empty__hint">
          <a href="/">トレンド一覧</a>からお気に入りを追加してみましょう
        </p>
      </div>
    );
  }

  // 登録日時順（新しい順）にソート
  const sortedFavorites = [...favorites].sort((a, b) => {
    return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
  });

  return (
    <div className="favorites-list">
      <div className="favorites-list__header">
        <h2>お気に入り ({favorites.length})</h2>
      </div>
      <div className="favorites-list__items">
        {sortedFavorites.map((fav) => (
          <RepositoryListItem
            key={fav.repoId}
            repo={{
              id: fav.repoId,
              full_name: fav.fullName,
              description: null,
              language: null,
              stargazers_count: 0,
              forks_count: 0,
            }}
            showMetrics={false}
            showFavoriteButton={true}
          />
        ))}
      </div>
    </div>
  );
}
