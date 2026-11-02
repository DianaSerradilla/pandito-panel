import type { Paging } from './usePaging.ts'

/** Footer with range, page size and previous/next. Hidden when everything fits on the smallest page size. */
export function Pager({ paging, label, id, sizes = [10, 25, 50, 100] }: { paging: Paging; label: string; id: string; sizes?: number[] }) {
  const { first, total, currentPage, pageCount, pageSize, setPage, setPageSize } = paging
  if (total <= sizes[0]) return null
  const shown = Math.min(pageSize, total - first)
  return (
    <nav aria-label={`Paginación de ${label}`} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
      <p className="hint">Mostrando {first + 1}–{first + shown} de {total}</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted" htmlFor={id}>
          Por página
          <select id={id} className="input min-h-9 w-20 py-0 text-sm" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {sizes.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-quiet min-h-9 px-3" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button>
        <span className="text-sm tabular-nums">Página {currentPage + 1} de {pageCount}</span>
        <button type="button" className="btn-quiet min-h-9 px-3" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Siguiente</button>
      </div>
    </nav>
  )
}
