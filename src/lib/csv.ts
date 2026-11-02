type Cell = string | number | null | undefined

/** Text cells that start with a formula character get a leading apostrophe so Excel never runs them. */
function escape(cell: Cell): string {
  if (cell === null || cell === undefined) return ''
  let text = String(cell)
  if (typeof cell === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Semicolon-separated rows with a UTF-8 BOM: Excel in Spanish locales opens it with accents and columns intact. */
export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escape).join(';'))
  return `﻿${lines.join('\r\n')}\r\n`
}

export function downloadCsv(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
