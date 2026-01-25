import React from "react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = React.memo(({ page, totalPages, onPageChange }) => {
  const handlePrev = React.useCallback(() => onPageChange(page - 1), [onPageChange, page]);
  const handleNext = React.useCallback(() => onPageChange(page + 1), [onPageChange, page]);
  if (totalPages <= 1) return null;
  return (
    <nav className="flex justify-center my-4" aria-label="Paginacja">
      <button
        className="mx-1 px-2 py-1 rounded border"
        onClick={handlePrev}
        disabled={page <= 1}
        aria-label="Poprzednia strona"
      >
        &lt;
      </button>
      <span className="mx-2">
        {page} / {totalPages}
      </span>
      <button
        className="mx-1 px-2 py-1 rounded border"
        onClick={handleNext}
        disabled={page >= totalPages}
        aria-label="Następna strona"
      >
        &gt;
      </button>
    </nav>
  );
});
Pagination.displayName = "Pagination";

export default Pagination;
