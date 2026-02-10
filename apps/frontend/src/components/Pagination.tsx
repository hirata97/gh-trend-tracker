/**
 * Pagination Component (COM-004)
 * Page navigation UI for lists and search results
 */

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Build page numbers to display, with ellipsis for large ranges.
 * Shows first, last, and up to 2 pages around current.
 */
function getPageNumbers(currentPage: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [1];

  if (currentPage > 3) {
    pages.push('...');
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < totalPages - 2) {
    pages.push('...');
  }

  pages.push(totalPages);

  return pages;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        className="pagination__button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Previous page"
      >
        &laquo;
      </button>

      {pages.map((page, index) =>
        page === '...' ? (
          <span key={`ellipsis-${index}`} className="pagination__ellipsis">
            &hellip;
          </span>
        ) : (
          <button
            key={page}
            className={`pagination__button ${page === currentPage ? 'pagination__button--active' : ''}`}
            onClick={() => onPageChange(page)}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </button>
        )
      )}

      <button
        className="pagination__button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Next page"
      >
        &raquo;
      </button>
    </nav>
  );
}
