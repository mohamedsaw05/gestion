import { useState, useMemo, type ReactNode } from 'react';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (row: T) => ReactNode;
  accessor?: (row: T) => unknown;
}

interface SmartTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  searchPlaceholder?: string;
  searchFields?: (keyof T | ((row: T) => string))[];
  filterSlot?: ReactNode;
  actionsSlot?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: {
    label: string;
    onClick: () => void;
  };
  pageSize?: number;
  onRowClick?: (row: T) => void;
  keyExtractor?: (row: T, index: number) => string;
}

export function SmartTable<T>({
  columns,
  data,
  loading = false,
  searchPlaceholder = 'Rechercher dans ce tableau...',
  searchFields,
  filterSlot,
  actionsSlot,
  emptyTitle,
  emptyDescription,
  emptyAction,
  pageSize = 20,
  onRowClick,
  keyExtractor,
}: SmartTableProps<T>) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Search filtering
  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;

    return data.filter((row) => {
      if (searchFields && searchFields.length > 0) {
        return searchFields.some((field) => {
          const val = typeof field === 'function' ? field(row) : row[field];
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(q);
        });
      }

      // Default fallback: search across all string/number fields of the row
      return Object.values(row as Record<string, unknown>).some((val) => {
        if (val === null || val === undefined) return false;
        if (typeof val === 'string' || typeof val === 'number') {
          return String(val).toLowerCase().includes(q);
        }
        return false;
      });
    });
  }, [data, search, searchFields]);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    const column = columns.find((c) => c.key === sortKey);
    if (!column) return filteredData;

    return [...filteredData].sort((a, b) => {
      let aVal = column.accessor ? column.accessor(a) : (a as Record<string, unknown>)[sortKey];
      let bVal = column.accessor ? column.accessor(b) : (b as Record<string, unknown>)[sortKey];

      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();

      return sortDirection === 'asc'
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
  }, [filteredData, sortKey, sortDirection, columns]);

  // Pagination
  const totalItems = sortedData.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, safePage, pageSize]);

  const handleSort = (columnKey: string) => {
    if (sortKey === columnKey) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortKey(null);
      }
    } else {
      setSortKey(columnKey);
      setSortDirection('asc');
    }
  };

  const handleClearSearch = () => {
    setSearch('');
    setCurrentPage(1);
  };

  return (
    <div className="smart-table-wrapper">
      {(searchPlaceholder || filterSlot || actionsSlot) && (
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            {searchPlaceholder && (
              <div className="table-search-box">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  className="table-search-input"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                {search && (
                  <button
                    type="button"
                    className="table-search-clear"
                    onClick={handleClearSearch}
                    aria-label="Effacer la recherche"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
            {filterSlot}
          </div>
          {actionsSlot && <div className="table-toolbar-right">{actionsSlot}</div>}
        </div>
      )}

      {loading ? (
        <div className="table-loading">
          <div className="loading-spinner" />
          <span>Chargement des données...</span>
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          type="no-data"
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      ) : sortedData.length === 0 ? (
        <EmptyState
          type="no-results"
          title="Aucun résultat correspondant"
          description={`Aucune entrée ne correspond à votre filtre « ${search} ».`}
          action={{
            label: 'Effacer la recherche',
            onClick: handleClearSearch,
          }}
        />
      ) : (
        <>
          <div className="table-scroll-container">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map((col) => {
                    const isSorted = sortKey === col.key;
                    return (
                      <th
                        key={col.key}
                        style={{
                          textAlign: col.align ?? 'left',
                          width: col.width,
                          cursor: col.sortable ? 'pointer' : 'default',
                        }}
                        onClick={() => col.sortable && handleSort(col.key)}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent:
                              col.align === 'right'
                                ? 'flex-end'
                                : col.align === 'center'
                                  ? 'center'
                                  : 'flex-start',
                            gap: '0.35rem',
                          }}
                        >
                          <span>{col.header}</span>
                          {col.sortable && (
                            <span className="sort-indicator" aria-hidden="true">
                              {isSorted ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((row, index) => {
                  const key = keyExtractor
                    ? keyExtractor(row, index)
                    : (row as Record<string, unknown>).id
                      ? String((row as Record<string, unknown>).id)
                      : String(index);

                  return (
                    <tr
                      key={key}
                      onClick={() => onRowClick && onRowClick(row)}
                      className={onRowClick ? 'clickable-row' : ''}
                    >
                      {columns.map((col) => {
                        const content = col.render
                          ? col.render(row)
                          : col.accessor
                            ? String(col.accessor(row) ?? '—')
                            : String((row as Record<string, unknown>)[col.key] ?? '—');

                        return (
                          <td
                            key={col.key}
                            style={{ textAlign: col.align ?? 'left' }}
                          >
                            {content}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="table-pagination">
              <span className="pagination-info">
                Affichage de {Math.min((safePage - 1) * pageSize + 1, totalItems)} à{' '}
                {Math.min(safePage * pageSize, totalItems)} sur {totalItems} résultats
              </span>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="btn-pagination"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Précédent
                </button>
                <span className="pagination-current">
                  Page {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="btn-pagination"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
