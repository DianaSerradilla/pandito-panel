import { useState, type FormEvent, type ReactNode } from 'react'
import { Drawer } from '../../components/Drawer.tsx'
import { useToast } from '../../components/toast.ts'
import { eventKindLabels, eventStatusLabels, type EventKind, type EventRow, type EventStatus } from '../../data/types.ts'
import { toIso, toLocalInput } from '../../lib/datetime.ts'
import { supabase } from '../../lib/supabase.ts'
import { EventLink } from './EventLink.tsx'
import { EventSummary } from './EventSummary.tsx'
import { HoyVariants } from './HoyVariants.tsx'

type Tab = 'data' | 'hoy' | 'summary'

const tabs: { id: Tab; label: string }[] = [
  { id: 'data', label: 'Datos' },
  { id: 'hoy', label: 'Diseños de HOY' },
  { id: 'summary', label: 'Resumen' },
]

const statusChip: Record<EventStatus, string> = { planned: 'chip chip-warn', active: 'chip chip-ok', closed: 'chip chip-off' }

const tabClass = (selected: boolean) =>
  `-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${
    selected ? 'border-naranja-dark text-tinta' : 'border-transparent text-muted hover:text-tinta'
  }`

/** Bottom bar of the panel: delete on the left, the state change and save on the right. */
function DrawerFooter({ leading, children }: { leading: ReactNode; children?: ReactNode }) {
  return (
    <footer className="flex items-center justify-between gap-3 border-t border-line bg-surface px-6 py-4">
      <div>{leading}</div>
      <div className="flex flex-wrap items-center justify-end gap-3">{children}</div>
    </footer>
  )
}

interface FooterActions {
  leading: ReactNode
  trailing: ReactNode
}

/** Name, date, place and HOY of one event, saved with the button at the bottom. */
function EventForm({ event, onSaved, leading, trailing }: { event: EventRow; onSaved: () => void } & FooterActions) {
  const [name, setName] = useState(event.name)
  const [kind, setKind] = useState<EventKind>(event.kind)
  const [date, setDate] = useState(event.event_date)
  const [location, setLocation] = useState(event.location ?? '')
  const [hoy, setHoy] = useState(event.hoy_enabled)
  const [starts, setStarts] = useState(toLocalInput(event.hoy_starts_at))
  const [ends, setEnds] = useState(toLocalInput(event.hoy_ends_at))
  const [saving, setSaving] = useState(false)
  const { notify } = useToast()
  const closed = event.status === 'closed'
  const dirty =
    name !== event.name ||
    kind !== event.kind ||
    date !== event.event_date ||
    location !== (event.location ?? '') ||
    hoy !== event.hoy_enabled ||
    starts !== toLocalInput(event.hoy_starts_at) ||
    ends !== toLocalInput(event.hoy_ends_at)

  async function save(submit: FormEvent) {
    submit.preventDefault()
    if (!supabase) return
    if (starts && ends && new Date(ends) <= new Date(starts)) {
      notify('El fin de HOY tiene que ser posterior al inicio.', 'error')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('events')
      .update({
        name: name.trim(),
        kind,
        event_date: date,
        location: location.trim() || null,
        hoy_enabled: hoy,
        hoy_starts_at: toIso(starts),
        hoy_ends_at: toIso(ends),
      })
      .eq('id', event.id)
    setSaving(false)
    if (error) {
      notify(error.message, 'error')
      return
    }
    notify('Evento guardado.', 'success')
    onSaved()
  }

  return (
    <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
      <fieldset disabled={closed} className="min-h-0 flex-1 space-y-8 overflow-y-auto overscroll-contain px-6 py-6">
        <section className="space-y-4" aria-labelledby="ev-data-title">
          <h3 id="ev-data-title" className="text-base font-semibold">Evento</h3>
          <div>
            <label htmlFor="e-name" className="label">Nombre</label>
            <input id="e-name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="e-kind" className="label">Tipo</label>
              <select id="e-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as EventKind)}>
                {Object.entries(eventKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="e-date" className="label">Fecha</label>
              <input id="e-date" type="date" required className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="e-loc" className="label">Lugar</label>
            <input id="e-loc" className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </section>

        <section className="space-y-4" aria-labelledby="ev-hoy-title">
          <div>
            <h3 id="ev-hoy-title" className="text-base font-semibold">HOY en la web</h3>
            <p className="hint">La página HOY muestra las variantes elegidas mientras el evento está activo.</p>
          </div>
          <div className="space-y-4 rounded-xl border border-line bg-white p-4">
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={hoy} onChange={(e) => setHoy(e.target.checked)} />
              Mostrar HOY en la web
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="e-starts" className="label">Desde (opcional)</label>
                <input id="e-starts" type="datetime-local" disabled={!hoy} className="input" value={starts} onChange={(e) => setStarts(e.target.value)} />
              </div>
              <div>
                <label htmlFor="e-ends" className="label">Hasta (opcional)</label>
                <input id="e-ends" type="datetime-local" disabled={!hoy} className="input" value={ends} onChange={(e) => setEnds(e.target.value)} />
              </div>
            </div>
          </div>
        </section>

        <EventLink eventCode={event.code} />
      </fieldset>

      <DrawerFooter leading={leading}>
        {trailing}
        {!closed && (
          <button type="submit" className={dirty ? 'btn' : 'btn-quiet'} disabled={!dirty || saving}>
            {saving ? 'Guardando…' : 'Guardar evento'}
          </button>
        )}
      </DrawerFooter>
    </form>
  )
}

interface Props {
  event: EventRow | null
  onChanged: () => void
  onClose: () => void
  onDelete: (event: EventRow) => void
}

/** One event in a side panel over the list: header with its state, tabs, and a bottom bar with the actions. */
export function EventDrawer({ event, onChanged, onClose, onDelete }: Props) {
  return (
    <Drawer open={event !== null} label={event ? `Evento ${event.name}` : 'Evento'} onClose={onClose}>
      {event && <EventContent key={event.id} event={event} onChanged={onChanged} onClose={onClose} onDelete={onDelete} />}
    </Drawer>
  )
}

function EventContent({ event, onChanged, onClose, onDelete }: { event: EventRow; onChanged: () => void; onClose: () => void; onDelete: (event: EventRow) => void }) {
  const [tab, setTab] = useState<Tab>('data')
  const { notify } = useToast()

  async function setStatus(status: 'planned' | 'active') {
    if (!supabase) return
    const { error } = await supabase.from('events').update({ status }).eq('id', event.id)
    if (error) {
      notify(error.code === '23505' ? 'Ya hay otro evento activo. Cerralo o volvelo a planificado primero.' : error.message, 'error')
      return
    }
    notify(status === 'active' ? 'Evento activado.' : 'Evento vuelto a planificado.', 'success')
    onChanged()
  }

  const leading = (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium text-danger hover:bg-red-50"
      onClick={() => onDelete(event)}
    >
      <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.6 9h6.8L12 4M6.8 6.5v4M9.2 6.5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Borrar
    </button>
  )
  const trailing = (
    <>
      {event.status === 'planned' && <button type="button" className="btn-quiet" onClick={() => void setStatus('active')}>Activar evento</button>}
      {event.status === 'active' && <button type="button" className="btn-quiet" onClick={() => void setStatus('planned')}>Volver a planificado</button>}
    </>
  )

  return (
    <>
      <header className="space-y-3 border-b border-line px-6 pb-0 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted">{event.code} · {eventKindLabels[event.kind]}</p>
            <h2 className="truncate text-xl font-semibold">{event.name}</h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-crema"
          >
            <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <span className={statusChip[event.status]}>{eventStatusLabels[event.status]}</span>
        <div role="tablist" aria-label="Secciones del evento" className="flex gap-1">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" id={`ev-tab-${t.id}`} aria-selected={tab === t.id} aria-controls="ev-panel" className={tabClass(tab === t.id)} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div id="ev-panel" role="tabpanel" aria-labelledby={`ev-tab-${tab}`} className="flex min-h-0 flex-1 flex-col">
        {tab === 'data' && (
          <EventForm
            key={`${event.id}-${event.name}-${event.event_date}-${event.hoy_enabled}-${event.kind}`}
            event={event}
            onSaved={onChanged}
            leading={leading}
            trailing={trailing}
          />
        )}
        {tab !== 'data' && (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">
              {tab === 'hoy' && <HoyVariants event={event} />}
              {tab === 'summary' && <EventSummary event={event} />}
            </div>
            <DrawerFooter leading={leading}>{trailing}</DrawerFooter>
          </>
        )}
      </div>
    </>
  )
}
