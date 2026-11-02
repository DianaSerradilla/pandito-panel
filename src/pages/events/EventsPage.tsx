import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Modal } from '../../components/Modal.tsx'
import { Pager } from '../../components/Pager.tsx'
import { SearchBox } from '../../components/SearchBox.tsx'
import { useToast } from '../../components/toast.ts'
import { usePaging } from '../../components/usePaging.ts'
import { eventKindLabels, eventStatusLabels, type EventKind, type EventRow, type EventStatus } from '../../data/types.ts'
import { useRows } from '../../data/useRows.ts'
import { supabase } from '../../lib/supabase.ts'
import { EventDrawer } from './EventDrawer.tsx'

const today = () => new Date().toISOString().slice(0, 10)
const statusChip: Record<EventStatus, string> = { planned: 'chip chip-warn', active: 'chip chip-ok', closed: 'chip chip-off' }
const formatDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })

function nextCode(events: EventRow[]) {
  const used = events.map((e) => Number(e.code.replace(/^EV-/, ''))).filter((n) => Number.isFinite(n))
  return `EV-${String(Math.max(0, ...used) + 1).padStart(3, '0')}`
}

/** Events: a table to search and open them, and a dialog to add one. Each row opens the event. */
export function EventsPage() {
  const navigate = useNavigate()
  const { eventId } = useParams()
  const events = useRows<EventRow>('events')
  const { notify } = useToast()
  const [toDelete, setToDelete] = useState<EventRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const opened = events.rows.find((e) => e.id === eventId) ?? null
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<EventStatus | ''>('')
  // Ventas links here with ?nuevo to open the "add event" dialog straight away.
  const [searchParams] = useSearchParams()
  const [adding, setAdding] = useState(searchParams.has('nuevo'))
  const [name, setName] = useState('')
  const [kind, setKind] = useState<EventKind>('other')
  const [date, setDate] = useState(today())
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)

  const needle = search.trim().toLowerCase()
  const visible = [...events.rows]
    .sort((a, b) => b.event_date.localeCompare(a.event_date) || b.code.localeCompare(a.code))
    .filter(
      (e) =>
        (!status || e.status === status) &&
        (!needle || e.name.toLowerCase().includes(needle) || e.code.toLowerCase().includes(needle) || (e.location ?? '').toLowerCase().includes(needle)),
    )
  const paging = usePaging(visible)

  async function create(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setSaving(true)
    const { data, error: failure } = await supabase
      .from('events')
      .insert({ code: nextCode(events.rows), name: name.trim(), kind, event_date: date, location: location.trim() || null })
      .select('id')
      .single()
    setSaving(false)
    if (failure || !data) {
      notify(failure?.message ?? 'No se pudo crear el evento.', 'error')
      return
    }
    notify('Evento creado.', 'success')
    setAdding(false)
    events.reload()
    void navigate(`/eventos/${data.id}`)
  }

  async function remove() {
    if (!supabase || !toDelete) return
    setDeleting(true)
    const { error } = await supabase.from('events').delete().eq('id', toDelete.id)
    setDeleting(false)
    if (error) {
      notify(
        error.code === '23503'
          ? 'Este evento ya tiene ventas o stock llevado, no se puede borrar. Cerralo en su lugar.'
          : error.message,
        'error',
      )
      return
    }
    notify(`${toDelete.name} borrado.`, 'success')
    if (toDelete.id === eventId) void navigate('/eventos')
    setToDelete(null)
    events.reload()
  }

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Eventos</h1>

      <div className="flex flex-wrap items-center gap-3">
        <SearchBox id="event-search" label="Buscar evento" placeholder="Buscar por nombre, código o lugar" value={search} onChange={(v) => { setSearch(v); paging.setPage(0) }} />
        <div className="w-48">
          <label className="sr-only" htmlFor="event-status">Estado</label>
          <select id="event-status" className="input" value={status} onChange={(e) => { setStatus(e.target.value as EventStatus | ''); paging.setPage(0) }}>
            <option value="">Todos los estados</option>
            {Object.entries(eventStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <button type="button" className="btn ml-auto" onClick={() => setAdding(true)}>Agregar evento</button>
      </div>

      {events.error && <p className="error" role="alert">{events.error}</p>}
      {!events.loading && events.rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-line bg-white px-6 py-8 text-center">
          <p className="font-medium">Todavía no hay eventos</p>
          <p className="hint mt-1">Con “Agregar evento” creás el primero y se abre para cargarle stock y HOY.</p>
        </div>
      )}
      {events.rows.length > 0 && visible.length === 0 && <p className="hint">Ningún evento coincide con la búsqueda.</p>}
      {visible.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Evento</th>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>Lugar</th>
                <th>Estado</th>
                <th>HOY</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paging.paged.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-muted">{e.code}</td>
                  <td className="font-medium">
                    <Link to={`/eventos/${e.id}`} className="hover:underline">{e.name}</Link>
                  </td>
                  <td className="whitespace-nowrap">{eventKindLabels[e.kind]}</td>
                  <td className="whitespace-nowrap">{formatDate(e.event_date)}</td>
                  <td>{e.location ?? <span className="text-muted">—</span>}</td>
                  <td className="whitespace-nowrap"><span className={statusChip[e.status]}>{eventStatusLabels[e.status]}</span></td>
                  <td className="whitespace-nowrap">
                    <span className={e.hoy_enabled ? 'chip chip-ok' : 'chip chip-off'}>{e.hoy_enabled ? 'Encendido' : 'Apagado'}</span>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/eventos/${e.id}`}
                        className="inline-flex size-11 items-center justify-center rounded-lg border border-line bg-white text-tinta hover:bg-crema"
                        aria-label={`Ver ${e.name}`}
                        title="Ver evento"
                      >
                        <svg aria-hidden width="18" height="18" viewBox="0 0 16 16" fill="none">
                          <path d="M1.5 8S3.8 3.5 8 3.5 14.5 8 14.5 8 12.2 12.5 8 12.5 1.5 8 1.5 8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
                        </svg>
                      </Link>
                      <button
                        type="button"
                        className="inline-flex size-11 items-center justify-center rounded-lg border border-line bg-white text-danger hover:bg-red-50"
                        aria-label={`Borrar ${e.name}`}
                        title="Borrar evento"
                        onClick={() => setToDelete(e)}
                      >
                        <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.6 9h6.8L12 4M6.8 6.5v4M9.2 6.5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager paging={paging} label="eventos" id="event-page-size" />

      <EventDrawer event={opened} onChanged={events.reload} onClose={() => void navigate('/eventos')} onDelete={setToDelete} />

      <Modal open={toDelete !== null} title="Borrar evento" onClose={() => !deleting && setToDelete(null)}>
        {toDelete && (
          <div className="space-y-4">
            <p>Vas a borrar <strong>{toDelete.code} · {toDelete.name}</strong> con sus variantes de HOY. No se puede deshacer.</p>
            <p className="hint">Un evento con ventas o stock llevado no se puede borrar: en ese caso cerralo.</p>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-quiet" disabled={deleting} onClick={() => setToDelete(null)}>Cancelar</button>
              <button type="button" className="btn" disabled={deleting} onClick={() => void remove()}>{deleting ? 'Borrando…' : 'Borrar evento'}</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={adding} title="Agregar evento" onClose={() => setAdding(false)}>
        <form onSubmit={create} className="space-y-4">
          <div>
            <label htmlFor="ev-name" className="label">Nombre</label>
            <input id="ev-name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ev-kind" className="label">Tipo</label>
              <select id="ev-kind" required className="input" value={kind} onChange={(e) => setKind(e.target.value as EventKind)}>
                {Object.entries(eventKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ev-date" className="label">Fecha</label>
              <input id="ev-date" type="date" required className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="ev-loc" className="label">Lugar (opcional)</label>
            <input id="ev-loc" className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <p className="hint">Nace planificado. Al crearlo se abre para cargar sus variantes, stock y HOY.</p>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-quiet" disabled={saving} onClick={() => setAdding(false)}>Cancelar</button>
            <button type="submit" className="btn" disabled={saving}>{saving ? 'Creando…' : 'Crear evento'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
