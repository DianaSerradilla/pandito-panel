/** ISO timestamp -> value for <input type="datetime-local"> in the viewer's time zone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

/** Value of <input type="datetime-local"> -> ISO timestamp (or null when empty). */
export function toIso(local: string): string | null {
  return local ? new Date(local).toISOString() : null
}
