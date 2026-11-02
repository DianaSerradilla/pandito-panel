import { useState } from 'react'
import { Link } from 'react-router'
import { Pager } from '../../components/Pager.tsx'
import { SearchBox } from '../../components/SearchBox.tsx'
import { usePaging } from '../../components/usePaging.ts'
import { eventStatusLabels, type EventRow, type EventStatus } from '../../data/types.ts'
import { Steps } from './Steps.tsx'

const statusChip: Record<EventStatus, string> = { planned: 'chip chip-warn', active: 'chip chip-ok', closed: 'chip chip-off' }
const formatDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })

/** Step 1 of Ventas: pick the event. If there is none, the person is guided to create it. */
export function EventPicker({ events, onChoose }: { events: EventRow[]; onChoose: (id: string) => Promise<void> }) {
  const [search, setSearch] = useState('')
  const [choosing, setChoosing] = useState(false)
  const needle = search.trim().toLowerCase()
  // Only planned events: an active one is already the event being sold, and a closed one is over.
  const notClosed = events.filter((e) => e.status === 'planned')
  const open = [...notClosed]
    .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || b.event_date.localeCompare(a.event_date))
    .filter((e) => !needle || e.name.toLowerCase().includes(needle) || e.code.toLowerCase().includes(needle) || (e.location ?? '').toLowerCase().includes(needle))
  const paging = usePaging(open, 10)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Steps current={1} />
      <div>
        <h1 className="text-2xl font-semibold">¿En qué evento vas a vender?</h1>
        <p className="hint">Al elegirlo queda activo para todos: quien abra Ventas entra directo a registrar, hasta que lo finalices.</p>
      </div>

      {notClosed.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line bg-white px-6 py-10 text-center">
          <p className="text-lg font-semibold">No hay eventos para vender</p>
          <p className="hint mx-auto mt-1 max-w-md">Creá el evento y cargale los stickers que vas a llevar. Después volvés acá, lo elegís y empezás a registrar.</p>
          <Link to="/eventos?nuevo" className="btn mt-5 inline-flex min-h-12 items-center px-6">Crear evento</Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <SearchBox id="picker-search" label="Buscar evento" placeholder="Buscar evento" value={search} onChange={(v) => { setSearch(v); paging.setPage(0) }} />
            <Link to="/eventos?nuevo" className="btn-quiet ml-auto inline-flex min-h-11 items-center px-4">Crear otro evento</Link>
          </div>
          {open.length === 0 && <p className="hint">Ningún evento coincide con la búsqueda.</p>}
          <ul className="grid gap-3 sm:grid-cols-2">
            {paging.paged.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  disabled={choosing}
                  onClick={() => {
                    setChoosing(true)
                    void onChoose(e.id).finally(() => setChoosing(false))
                  }}
                  className="flex min-h-24 w-full flex-col items-start justify-between gap-3 rounded-2xl border-2 border-line bg-white px-4 py-3 text-left hover:border-naranja-dark active:bg-crema"
                >
                  <span className="flex w-full items-start justify-between gap-3">
                    <span className="min-w-0 text-lg font-semibold">{e.name}</span>
                    <span className={`${statusChip[e.status]} shrink-0`}>{eventStatusLabels[e.status]}</span>
                  </span>
                  <span className="text-sm text-muted">
                    {formatDate(e.event_date)}{e.location ? ` · ${e.location}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Pager paging={paging} label="eventos" id="picker-page-size" />
        </>
      )}
    </div>
  )
}
