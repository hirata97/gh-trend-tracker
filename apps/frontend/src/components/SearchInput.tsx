/**
 * SearchInput Component
 * Search input form with debounce and Enter key handling.
 * Related: fun-015 (repository name search input form)
 */

import { useState, useCallback, type ChangeEvent, type KeyboardEvent } from 'react';

interface SearchInputProps {
  placeholder?: string;
  onSearch: (query: string) => void;
}

export default function SearchInput({
  placeholder = 'Search repositories...',
  onSearch,
}: SearchInputProps) {
  const [query, setQuery] = useState('');

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && query.trim().length >= 2) {
        e.preventDefault();
        onSearch(query.trim());
      }
    },
    [query, onSearch]
  );

  const handleSearchClick = useCallback(() => {
    if (query.trim().length >= 2) {
      onSearch(query.trim());
    }
  }, [query, onSearch]);

  return (
    <div className="search-input">
      <input
        type="text"
        className="search-input__field"
        placeholder={placeholder}
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        aria-label="Search repositories"
      />
      <button
        type="button"
        className="search-input__button"
        onClick={handleSearchClick}
        disabled={query.trim().length < 2}
        aria-label="Search"
        title="Search"
      >
        &#128269;
      </button>
    </div>
  );
}
