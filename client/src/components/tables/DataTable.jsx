import { useIsMobile } from '../../hooks/useMediaQuery';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';

export default function DataTable({
  columns = [],
  data = [],
  pagination,
  onPageChange,
  onRowClick,
  emptyMessage = 'No data found',
  className = '',
}) {
  const isMobile = useIsMobile();

  if (!data.length) {
    return (
      <div className="text-center py-12 text-surface-500">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  // ── Mobile: Card Layout ──────────────────────────────────────────
  if (isMobile) {
    return (
      <div className={`space-y-3 ${className}`}>
        {data.map((row, ri) => (
          <div
            key={ri}
            onClick={() => onRowClick?.(row)}
            className={`glass-card-solid p-4 space-y-2 ${onRowClick ? 'cursor-pointer hover:shadow-card-hover active:scale-[0.99] transition-all' : ''}`}
          >
            {columns.map((col, ci) => (
              <div key={ci} className="flex items-start justify-between gap-3 min-w-0">
                <span className="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider flex-shrink-0">
                  {col.header}
                </span>
                <div className="text-sm text-surface-900 dark:text-surface-100 text-right min-w-0 break-words">
                  {col.cell ? col.cell(row) : row[col.accessor]}
                </div>
              </div>
            ))}
          </div>
        ))}
        {pagination && <Pagination pagination={pagination} onPageChange={onPageChange} />}
      </div>
    );
  }

  // ── Desktop: Table Layout ────────────────────────────────────────
  return (
    <div className={className}>
      <div className="overflow-x-auto rounded-xl border border-surface-200 dark:border-surface-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700">
              {columns.map((col, ci) => (
                <th
                  key={ci}
                  className="px-4 py-3 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
            {data.map((row, ri) => (
              <tr
                key={ri}
                onClick={() => onRowClick?.(row)}
                className={`bg-white dark:bg-surface-800 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                {columns.map((col, ci) => (
                  <td key={ci} className="px-4 py-3.5 text-surface-700 dark:text-surface-300 whitespace-nowrap">
                    {col.cell ? col.cell(row) : row[col.accessor]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && <Pagination pagination={pagination} onPageChange={onPageChange} />}
    </div>
  );
}

function Pagination({ pagination, onPageChange }) {
  const { page, pages, total } = pagination;
  if (pages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 px-1">
      <p className="text-xs text-surface-500">
        Showing page {page} of {pages} ({total} total)
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange?.(page - 1)}
          disabled={page <= 1}
          className="btn-icon hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg disabled:opacity-40"
          aria-label="Previous page"
        >
          <HiChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
          let pageNum;
          if (pages <= 5) pageNum = i + 1;
          else if (page <= 3) pageNum = i + 1;
          else if (page >= pages - 2) pageNum = pages - 4 + i;
          else pageNum = page - 2 + i;
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange?.(pageNum)}
              className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${
                pageNum === page
                  ? 'bg-primary-600 text-white'
                  : 'hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-400'
              }`}
            >
              {pageNum}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange?.(page + 1)}
          disabled={page >= pages}
          className="btn-icon hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg disabled:opacity-40"
          aria-label="Next page"
        >
          <HiChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
