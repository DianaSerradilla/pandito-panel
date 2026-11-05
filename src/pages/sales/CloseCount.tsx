import { useState } from 'react'
import { Pager } from '../../components/Pager.tsx'
import { SearchBox } from '../../components/SearchBox.tsx'
import { usePaging } from '../../components/usePaging.ts'
import { useToast } from '../../components/toast.ts'
import type { EventRow } from '../../data/types.ts'
import { useRows } from '../../data/useRows.ts'
import type { VariantInfo } from '../../data/useVariantCatalog.ts'
import { usePendingTickets } from '../../lib/pendingTickets.ts'
import { supabase } from '../../lib/supabase.ts'

interface Props {
  event: EventRow
  items: VariantInfo[]
  /** Units still in the ticket that were never registered. */
  pending: number
  onBack: () => void
  onClosed: () => void
}

interface TicketLite {
  id: string
  event_id: string | null
  status: 'confirmed' | 'voided'
}

interface LineLite {
  ticket_id: string
  variant_id: string
  quantity: number
}

interface Entry {
  carried: string
  left: string
  note: string
}

const blank: Entry = { carried: '', left: '', note: '' }
const toInt = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value) : null)

/** Closing section of step 3: count what came back, explain differences, then finish the event. */
export function CloseCount({ event, items, pending, onBack, onClosed }: Props) {
  const tickets = useRows<TicketLite>('tickets')
  const lines = useRows<LineLite>('ticket_items')
  const planned = useRows<{ event_id: string; variant_id: string }>('event_variants')
  const { notify } = useToast()
  const [entries, setEntries] = useState<Record<string, Entry>>({})
  const [search, setSearch] = useState('')
  const [closing, setClosing] = useState(false)
  const unsent = usePendingTickets().filter((t) => t.eventId === event.id).length

  const confirmed = new Set(tickets.rows.filter((t) => t.event_id === event.id && t.status === 'confirmed').map((t) => t.id))
  const used = new Map<string, number>()
  for (const line of lines.rows) {
    if (confirmed.has(line.ticket_id)) used.set(line.variant_id, (used.get(line.variant_id) ?? 0) + line.quantity)
  }

  const ids = new Set([...planned.rows.filter((p) => p.event_id === event.id).map((p) => p.variant_id), ...used.keys()])
  const rows = items.filter((i) => ids.has(i.id))
  const entryOf = (id: string) => entries[id] ?? blank
  const setEntry = (id: string, patch: Partial<Entry>) => setEntries((prev) => ({ ...prev, [id]: { ...(prev[id] ?? blank), ...patch } }))

  const analysed = rows.map((info) => {
    const entry = entryOf(info.id)
    const sold = used.get(info.id) ?? 0
    const carried = toInt(entry.carried)
    const left = toInt(entry.left)
    const touched = sold > 0 || entry.carried !== '' || entry.left !== ''
    const expected = carried === null ? null : carried - sold
    const diff = expected === null || left === null ? null : left - expected
    const problem =
      !touched ? null
      : carried === null || left === null ? 'Completá cuántos llevaste y cuántos quedaron.'
      : expected !== null && expected < 0 ? 'Llevaste menos de lo que registraste.'
      : diff !== 0 && entry.note.trim() === '' ? 'Explicá la diferencia.'
      : null
    return { info, entry, sold, carried, left, touched, expected, diff, problem }
  })

  const needle = search.trim().toLowerCase()
  const visible = analysed.filter((r) => !needle || r.info.label.toLowerCase().includes(needle))
  const paging = usePaging(visible, 5)
  const blocking = analysed.filter((r) => r.problem)

  async function close() {
    if (!supabase) return
    const payload = analysed
      .filter((r) => r.touched && r.carried !== null && r.left !== null)
      .map((r) => ({ variant_id: r.info.id, carried: r.carried, counted: r.left, note: r.entry.note.trim() || null }))
    setClosing(true)
    const { error: failure } = await supabase.rpc('close_event_counted', { p_event_id: event.id, p_rows: payload })
    setClosing(false)
    if (failure) {
      notify(failure.message, 'error')
      return
    }
    notify(`Evento finalizado: ${event.name}`, 'success')
    onClosed()
  }

  return (
    <section aria-labelledby="finish-close" className="space-y-4 rounded-2xl border-2 border-line bg-white p-4 sm:p-5">
      <div>
        <h2 id="finish-close" className="text-lg font-semibold">Conteo y cierre</h2>
        <p className="hint">Anotá cuántos llevaste y cuántos quedaron de cada sticker. Si no cierra con lo vendido, dejá la nota. Un evento cerrado ya no admite registros ni anulaciones.</p>
      </div>

      {rows.length > 0 && (
        <SearchBox id="count-search" label="Buscar sticker del conteo" placeholder="Buscar sticker" value={search} onChange={setSearch} />
      )}
      {rows.length === 0 && !lines.loading && <p className="hint">Este evento no tiene stickers. Podés cerrarlo sin conteo.</p>}

      <ul className="space-y-3">
        {paging.paged.map(({ info, entry, sold, expected, diff, problem, touched }) => (
          <li key={info.id} className="space-y-3 rounded-xl border border-line p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="min-w-0 font-medium">{info.productName}</p>
              <p className="text-sm text-muted">{info.sizeName} · {info.materialName} · {info.finishName}</p>
            </div>
            <div className="grid grid-cols-3 items-end gap-3">
              <div>
                <p className="label">Registrados</p>
                <p className="flex min-h-11 items-center text-lg font-semibold tabular-nums">{sold}</p>
              </div>
              <div>
                <label className="label" htmlFor={`carried-${info.id}`}>Llevé</label>
                <input id={`carried-${info.id}`} inputMode="numeric" className="input" value={entry.carried} onChange={(e) => setEntry(info.id, { carried: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor={`left-${info.id}`}>Quedaron</label>
                <input id={`left-${info.id}`} inputMode="numeric" className="input" value={entry.left} onChange={(e) => setEntry(info.id, { left: e.target.value })} />
              </div>
            </div>
            {touched && diff !== null && expected !== null && expected >= 0 && (
              <p className={`chip ${diff === 0 ? 'chip-ok' : 'chip-warn'}`}>
                {diff === 0 ? 'Sin diferencia' : diff < 0 ? `Faltan ${-diff}: se registran como pérdida` : `Sobran ${diff}`}
              </p>
            )}
            {touched && diff !== null && diff !== 0 && expected !== null && expected >= 0 && (
              <div>
                <label className="label" htmlFor={`note-${info.id}`}>Qué pasó</label>
                <input id={`note-${info.id}`} className="input" value={entry.note} onChange={(e) => setEntry(info.id, { note: e.target.value })} />
              </div>
            )}
            {problem && diff === null && <p className="hint">{problem}</p>}
            {problem && diff !== null && <p className="error" role="alert">{problem}</p>}
          </li>
        ))}
      </ul>
      <Pager paging={paging} label="stickers del conteo" id="count-page-size" />

      {pending > 0 && (
        <p className="error" role="alert">
          Tenés {pending} {pending === 1 ? 'sticker' : 'stickers'} sin registrar en el ticket. Volvé a registrar y confirmalos, o vaciá el ticket.
        </p>
      )}
      {unsent > 0 && (
        <p className="error" role="alert">
          Hay {unsent} {unsent === 1 ? 'ticket guardado' : 'tickets guardados'} en este celular sin enviar. Con conexión se mandan solos; después podés finalizar.
        </p>
      )}
      {blocking.length > 0 && <p className="hint">Faltan datos en {blocking.length} {blocking.length === 1 ? 'sticker' : 'stickers'} para poder cerrar.</p>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" className="btn-quiet min-h-12" disabled={closing} onClick={onBack}>Volver a registrar</button>
        <button type="button" className="btn min-h-12" disabled={closing || pending > 0 || unsent > 0 || blocking.length > 0} onClick={() => void close()}>
          {closing ? 'Finalizando…' : 'Finalizar evento'}
        </button>
      </div>
    </section>
  )
}
