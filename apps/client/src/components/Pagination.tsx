export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  itemName?: string;
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize = 20,
  onPageChange,
  itemName = 'résultats',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  if (totalItems === 0) {
    return null;
  }

  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, totalItems);

  return (
    <div className="table-pagination">
      <span className="pagination-info">
        Affichage de <strong>{from}</strong> à <strong>{to}</strong> sur <strong>{totalItems}</strong> {itemName}
      </span>
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            type="button"
            className="btn-pagination"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
          >
            ← Précédent
          </button>
          <span className="pagination-current" style={{ fontWeight: 600, padding: '0 0.25rem' }}>
            Page {safePage} / {totalPages}
          </span>
          <button
            type="button"
            className="btn-pagination"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
}
