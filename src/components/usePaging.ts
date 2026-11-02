import { useState } from 'react'

/** Slices a list into pages; the page is clamped, so a shorter list never leaves you on an empty page. */
export function usePaging<T>(items: T[], initialSize = 25) {
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(initialSize)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const first = currentPage * pageSize
  return {
    paged: items.slice(first, first + pageSize),
    first,
    total: items.length,
    currentPage,
    pageCount,
    pageSize,
    setPage,
    setPageSize: (size: number) => {
      setPageSize(size)
      setPage(0)
    },
  }
}

export type Paging = ReturnType<typeof usePaging>
