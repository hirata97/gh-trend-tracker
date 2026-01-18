/**
 * LanguageFilter Component
 * Dropdown to filter repositories by programming language
 */

interface Props {
  languages: (string | null)[];
  currentLanguage?: string;
}

export default function LanguageFilter({ languages, currentLanguage }: Props) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const language = e.target.value;

    // Reload page with language parameter
    if (language === '') {
      window.location.href = '/';
    } else {
      window.location.href = `/?language=${encodeURIComponent(language)}`;
    }
  };

  // Filter out null languages and sort
  const validLanguages = languages.filter((lang): lang is string => lang !== null).sort();

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label htmlFor="language-filter" style={{ marginRight: '0.5rem', fontWeight: 500 }}>
        Filter by Language:
      </label>
      <select id="language-filter" onChange={handleChange} defaultValue={currentLanguage || ''}>
        <option value="">All Languages</option>
        {validLanguages.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </select>
    </div>
  );
}
