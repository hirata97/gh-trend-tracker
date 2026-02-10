/**
 * LanguageFilterDropdown Component (COM-003)
 * Language selection dropdown with callback-based API.
 * Extends the existing LanguageFilter with a more flexible interface.
 */

import { useId } from 'react';

interface LanguageFilterDropdownProps {
  currentLanguage: string;
  availableLanguages: string[];
  onSelect: (language: string) => void;
}

export default function LanguageFilterDropdown({
  currentLanguage,
  availableLanguages,
  onSelect,
}: LanguageFilterDropdownProps) {
  const selectId = useId();
  const sorted = [...availableLanguages].sort();

  return (
    <div className="language-filter-dropdown">
      <label htmlFor={selectId} className="language-filter-dropdown__label">
        Language:
      </label>
      <select
        id={selectId}
        className="language-filter-dropdown__select"
        value={currentLanguage}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="">All Languages</option>
        {sorted.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </select>
    </div>
  );
}
