import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal.tsx'
import { Pager } from '../../components/Pager.tsx'
import { SearchBox } from '../../components/SearchBox.tsx'
import { useToast } from '../../components/toast.ts'
import { usePaging } from '../../components/usePaging.ts'
import { useRows } from '../../data/useRows.ts'
import { supabase } from '../../lib/supabase.ts'
import { categories, relativeLabel, syncCalendar, today, type CalendarCategory, type CalendarEvent } from './calendarData.ts'

const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const categoryKeys = Object.keys(categories) as CalendarCategory[]
const monthLabel = (date: Date) => date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
const dayKey = (date: Date, day: number) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
const longDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
const firstOfThisMonth = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)

/** Month grid plus the list of what is coming. Holidays and commercial dates keep themselves up to date. */
export function CalendarPanel() {
  const calendar = useRows<CalendarEvent>('calendar_events', ['event_date'])
  const { notify } = useToast()
  const [month, setMonth] = useState(firstOfThisMonth)
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState<CalendarCategory | ''>('')
  const [search, setSearch] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(today())
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<CalendarCategory>('other')
  const [note, setNote] = useState('')
  const checked = useRef(false)

  // Every year that has no holidays yet is filled in automatically, once per visit.
  useEffect(() => {
    if (calendar.loading || checked.current) return
    checked.current = true
    const year = new Date().getFullYear()
    const missing = [year, year + 1].filter((y) => !calendar.rows.some((r) => r.source === 'holidays' && r.event_date.startsWith(String(y))))
    if (missing.length > 0) void syncCalendar(missing).then(calendar.reload).catch(() => undefined)
  }, [calendar.loading, calendar.rows, calendar.reload])

  const visible = calendar.rows.filter((e) => !filter || e.category === filter)
  const byDay = new Map<string, CalendarEvent[]>()
  for (const e of visible) byDay.set(e.event_date, [...(byDay.get(e.event_date) ?? []), e])

  const offset = (month.getDay() + 6) % 7
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, i) => i - offset + 1)
  const todayKey = today()

  const needle = search.trim().toLowerCase()
  const upcoming = visible.filter((e) => e.event_date >= todayKey && (!needle || e.title.toLowerCase().includes(needle)))
  const paging = usePaging(upcoming, 5)
  const selectedEvents = selected ? (byDay.get(selected) ?? []) : []

  const shiftMonth = (by: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1))

  async function refresh() {
    setSyncing(true)
    const year = new Date().getFullYear()
    try {
      const saved = await syncCalendar([year, year + 1])
      notify(`Calendario actualizado (${saved} fechas).`, 'success')
    } catch (failure) {
      notify(failure instanceof Error ? failure.message : 'No se pudo actualizar.', 'error')
    }
    setSyncing(false)
    calendar.reload()
  }

  async function add(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setSaving(true)
    const { error: failure } = await supabase.from('calendar_events').insert({ event_date: date, title: title.trim(), category, note: note.trim() || null })
    setSaving(false)
    if (failure) {
      notify(failure.message, 'error')
      return
    }
    notify('Fecha agregada.', 'success')
    setAdding(false)
    setTitle('')
    setNote('')
    calendar.reload()
  }

  async function remove(id: string) {
    if (!supabase) return
    const { error: failure } = await supabase.from('calendar_events').delete().eq('id', id)
    if (failure) notify(failure.message, 'error')
    calendar.reload()
  }

  return (
    <section className="space-y-5 rounded-2xl border border-line bg-white p-4 sm:p-5" aria-labelledby="calendar-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="calendar-title" className="text-lg font-semibold">Calendario para vender</h2>
          <p className="hint">Feriados y fechas comerciales se actualizan solos. Sumá partidos, estrenos o fiestas a mano.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-48">
            <label htmlFor="cal-filter" className="sr-only">Tipo de fecha</label>
            <select id="cal-filter" className="input" value={filter} onChange={(e) => setFilter(e.target.value as CalendarCategory | '')}>
              <option value="">Todos los tipos</option>
              {categoryKeys.map((key) => <option key={key} value={key}>{categories[key].label}</option>)}
            </select>
          </div>
          <button type="button" className="btn-quiet min-h-11" disabled={syncing} onClick={() => void refresh()}>{syncing ? 'Actualizando…' : 'Actualizar'}</button>
          <button type="button" className="btn min-h-11" onClick={() => setAdding(true)}>Agregar fecha</button>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xl font-semibold capitalize">{monthLabel(month)}</p>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Mes anterior" className="btn-quiet size-11 px-0 text-lg" onClick={() => shiftMonth(-1)}>‹</button>
              <button
                type="button"
                className="btn-quiet min-h-11 px-4"
                onClick={() => {
                  setMonth(firstOfThisMonth())
                  setSelected(todayKey)
                }}
              >
                Hoy
              </button>
              <button type="button" aria-label="Mes siguiente" className="btn-quiet size-11 px-0 text-lg" onClick={() => shiftMonth(1)}>›</button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-line">
            <div className="grid grid-cols-7 bg-crema text-center text-xs font-medium text-muted">
              {weekdays.map((d) => <span key={d} className="py-2">{d}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-px bg-line">
              {cells.map((day, index) => {
                if (day < 1 || day > daysInMonth) return <span key={index} className="min-h-14 bg-crema/60 sm:min-h-24" />
                const key = dayKey(month, day)
                const events = byDay.get(key) ?? []
                const isToday = key === todayKey
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSelected(selected === key ? null : key)}
                    aria-pressed={selected === key}
                    aria-label={`${day} de ${monthLabel(month)}${events.length ? `, ${events.length} fechas` : ''}`}
                    className={`flex min-h-14 flex-col items-start gap-1 bg-white p-1.5 text-left hover:bg-crema sm:min-h-24 ${selected === key ? 'ring-2 ring-inset ring-tinta' : ''}`}
                  >
                    <span className={`inline-flex size-6 items-center justify-center rounded-full text-sm ${isToday ? 'bg-naranja-dark font-semibold text-white' : ''}`}>{day}</span>
                    <span className="flex flex-wrap gap-1 sm:hidden">
                      {events.slice(0, 3).map((e) => <span key={e.id} aria-hidden className={`size-2 rounded-full ${categories[e.category].dot}`} />)}
                    </span>
                    <span className="hidden w-full space-y-0.5 sm:block">
                      {events.slice(0, 2).map((e) => (
                        <span key={e.id} className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-4 ${categories[e.category].chip}`}>{e.title}</span>
                      ))}
                      {events.length > 2 && <span className="block px-1 text-[11px] text-muted">+{events.length - 2} más</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {selected && (
            <div className="rounded-xl border border-line bg-crema p-4">
              <p className="font-semibold capitalize">{longDate(selected)}</p>
              {selectedEvents.length === 0 ? (
                <p className="hint">No hay fechas cargadas este día.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {selectedEvents.map((e) => (
                    <li key={e.id} className="flex items-center gap-2 text-sm">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${categories[e.category].chip}`}>{categories[e.category].label}</span>
                      <span className="min-w-0 flex-1">{e.title}{e.note ? <span className="text-muted"> · {e.note}</span> : null}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Próximas fechas</h3>
          <SearchBox id="calendar-search" label="Buscar fecha" placeholder="Buscar fecha" value={search} onChange={(v) => { setSearch(v); paging.setPage(0) }} />
          {calendar.error && <p className="error" role="alert">{calendar.error}</p>}
          {!calendar.loading && upcoming.length === 0 && <p className="hint">No hay próximas fechas con estos filtros.</p>}
          <ul className="overflow-hidden rounded-xl border border-line">
            {paging.paged.map((e) => {
              const d = new Date(`${e.event_date}T00:00:00`)
              return (
                <li key={e.id} className="flex items-center gap-3 border-t border-line p-3 first:border-t-0">
                  <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-crema leading-tight">
                    <span className="text-lg font-semibold">{d.getDate()}</span>
                    <span className="text-[11px] uppercase text-muted">{d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.title}</span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${categories[e.category].chip}`}>{categories[e.category].label}</span>
                      {relativeLabel(e.event_date)}
                    </span>
                  </span>
                  {e.source === 'manual' && (
                    <button type="button" aria-label={`Borrar ${e.title}`} title="Borrar" className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-crema" onClick={() => void remove(e.id)}>
                      <svg aria-hidden width="18" height="18" viewBox="0 0 16 16" fill="none">
                        <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8h5.8l.6-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          <Pager paging={paging} label="próximas fechas" id="calendar-page-size" sizes={[5, 10, 25]} />
        </div>
      </div>

      <Modal open={adding} title="Agregar fecha" onClose={() => !saving && setAdding(false)}>
        <form onSubmit={(e) => void add(e)} className="space-y-4">
          <div>
            <label className="label" htmlFor="cal-title">Qué es</label>
            <input id="cal-title" className="input" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Argentina vs Brasil" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="cal-date">Fecha</label>
              <input id="cal-date" type="date" className="input" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="cal-category">Tipo</label>
              <select id="cal-category" className="input" value={category} onChange={(e) => setCategory(e.target.value as CalendarCategory)}>
                {categoryKeys.map((key) => <option key={key} value={key}>{categories[key].label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="cal-note">Nota (opcional)</label>
            <input id="cal-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="btn-quiet min-h-12" disabled={saving} onClick={() => setAdding(false)}>Cancelar</button>
            <button type="submit" className="btn min-h-12" disabled={saving || title.trim() === ''}>{saving ? 'Guardando…' : 'Agregar fecha'}</button>
          </div>
        </form>
      </Modal>
    </section>
  )
}
