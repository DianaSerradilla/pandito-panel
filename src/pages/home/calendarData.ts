import { supabase } from '../../lib/supabase.ts'

export type CalendarCategory = 'holiday' | 'patriotic' | 'commercial' | 'football' | 'movie' | 'music' | 'party' | 'other'

export interface CalendarEvent {
  id: string
  event_date: string
  title: string
  category: CalendarCategory
  source: string
  external_id: string | null
  note: string | null
}

interface CalendarSeed {
  event_date: string
  title: string
  category: CalendarCategory
  source: 'holidays' | 'commercial'
  external_id: string
}

export const categories: Record<CalendarCategory, { label: string; chip: string; dot: string }> = {
  holiday: { label: 'Feriado', chip: 'bg-azul/15 text-azul', dot: 'bg-azul' },
  patriotic: { label: 'Fecha patria', chip: 'bg-ok/15 text-ok', dot: 'bg-ok' },
  commercial: { label: 'Fecha comercial', chip: 'bg-naranja/20 text-naranja-dark', dot: 'bg-naranja' },
  football: { label: 'Partido', chip: 'bg-tinta/10 text-tinta', dot: 'bg-tinta' },
  movie: { label: 'Estreno', chip: 'bg-danger/15 text-danger', dot: 'bg-danger' },
  music: { label: 'Disco o show', chip: 'bg-amarillo/50 text-tinta', dot: 'bg-amarillo' },
  party: { label: 'Fiesta', chip: 'bg-naranja-dark/15 text-naranja-dark', dot: 'bg-naranja-dark' },
  other: { label: 'Otro', chip: 'bg-line text-muted', dot: 'bg-muted' },
}

const iso = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

/** The n-th given weekday (0 = Sunday) of a month, as a date string. */
function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const first = new Date(year, month, 1).getDay()
  return iso(year, month, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7)
}

/** Dates that matter for a sticker shop in Argentina and follow a fixed rule, so no service is needed. */
export function commercialDates(year: number): CalendarSeed[] {
  const rows: [string, string, CalendarCategory][] = [
    [iso(year, 0, 6), 'Día de Reyes', 'commercial'],
    [iso(year, 1, 14), 'San Valentín', 'commercial'],
    [iso(year, 2, 8), 'Día de la Mujer', 'commercial'],
    [nthWeekday(year, 5, 0, 3), 'Día del Padre', 'commercial'],
    [iso(year, 6, 20), 'Día del Amigo', 'commercial'],
    [nthWeekday(year, 7, 0, 3), 'Día de las Infancias', 'commercial'],
    [iso(year, 8, 21), 'Día de la Primavera y del Estudiante', 'party'],
    [nthWeekday(year, 9, 0, 3), 'Día de la Madre', 'commercial'],
    [iso(year, 9, 31), 'Halloween', 'party'],
    [nthWeekday(year, 10, 5, 4), 'Black Friday', 'commercial'],
    [iso(year, 11, 24), 'Nochebuena', 'party'],
    [iso(year, 11, 31), 'Fin de año', 'party'],
  ]
  return rows.map(([event_date, title, category]) => ({ event_date, title, category, source: 'commercial', external_id: `${event_date}-${title}` }))
}

interface HolidayResponse {
  date: string
  localName: string
}

const patrioticName = /independencia|revoluci|bandera|soberan|malvinas|san mart|güemes|guemes|belgrano/i

/** Public holidays of Argentina from a free public API (no key). */
async function fetchHolidays(year: number): Promise<CalendarSeed[]> {
  const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/AR`)
  if (!response.ok) throw new Error(`No se pudieron traer los feriados de ${year}.`)
  const holidays = (await response.json()) as HolidayResponse[]
  return holidays.map((h) => ({
    event_date: h.date,
    title: h.localName,
    category: patrioticName.test(h.localName) ? 'patriotic' : 'holiday',
    source: 'holidays',
    external_id: h.date,
  }))
}

/** Writes the automatic dates of the given years. Existing rows are updated, never duplicated. Returns how many were saved. */
export async function syncCalendar(years: number[]) {
  const client = supabase
  if (!client) throw new Error('Sin conexión con la base.')
  const seeds: CalendarSeed[] = years.flatMap(commercialDates)
  let failed: number | null = null
  for (const year of years) {
    try {
      seeds.push(...(await fetchHolidays(year)))
    } catch {
      failed = year
    }
  }
  const { error } = await client.from('calendar_events').upsert(seeds, { onConflict: 'source,external_id' })
  if (error) throw new Error(error.message)
  if (failed !== null) throw new Error(`Se guardaron las fechas comerciales, pero no se pudieron traer los feriados de ${failed}. Probá de nuevo en un rato.`)
  return seeds.length
}

export const today = () => new Date().toLocaleDateString('sv-SE')

export function daysUntil(date: string) {
  return Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${today()}T00:00:00`).getTime()) / 86_400_000)
}

export function relativeLabel(date: string) {
  const days = daysUntil(date)
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Mañana'
  if (days < 0) return `Hace ${-days} días`
  return `En ${days} días`
}
