import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal.tsx'
import { Pager } from '../../components/Pager.tsx'
import { SearchBox } from '../../components/SearchBox.tsx'
import { useToast } from '../../components/toast.ts'
import { usePaging } from '../../components/usePaging.ts'
import type { EventRow, ReconciliationRow } from '../../data/types.ts'
import { useRows } from '../../data/useRows.ts'
import { useVariantCatalog } from '../../data/useVariantCatalog.ts'
import { supabase } from '../../lib/supabase.ts'

const differenceText = (diff: number) => (diff === 0 ? 'Sin diferencia' : diff < 0 ? `Faltan ${-diff}` : `Sobran ${diff}`)

/** Stock taken to the event, live reconciliation, and the closing count. */
export function StockAndClose({ event, onClosed }: { event: EventRow; onClosed: () => void }) {
  const catalog = useVariantCatalog()
  const reconciliation = useRows<ReconciliationRow>('event_reconciliation')
  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [closing, setClosing] = useState(false)
  const { notify } = useToast()
  const closed = event.status === 'closed'

  const label = (id: string) => catalog.items.find((item) => item.id === id)?.label ?? id
  const rows = reconciliation.rows.filter((r) => r.event_id === event.id)
  const carriedRows = rows.filter((r) => r.carried > 0)
  const otherRows = rows.filter((r) => r.carried === 0)
  const countFor = (r: ReconciliationRow) => counts[r.variant_id] ?? String(Math.max(r.expected_remaining, 0))
  const needle = search.trim().toLowerCase()
  const shown = carriedRows.filter((r) => !needle || label(r.variant_id).toLowerCase().includes(needle))
  const paging = usePaging(shown, 10)

  async function carry(submit: FormEvent) {
    submit.preventDefault()
    if (!supabase) return
    const { error: failure } = await supabase
      .from('stock_movements')
      .insert({ variant_id: variantId, type: 'event_out', quantity: Number(quantity), event_id: event.id })
    if (failure) {
      notify(failure.message, 'error')
      return
    }
    setQuantity('')
    reconciliation.reload()
  }

  async function close() {
    if (!supabase) return
    setClosing(true)
    const payload = carriedRows.map((r) => ({
      variant_id: r.variant_id,
      counted: Number(countFor(r)),
      note: notes[r.variant_id] ?? '',
    }))
    const { error: failure } = await supabase.rpc('close_event', { p_event_id: event.id, p_counts: payload })
    setClosing(false)
    if (failure) {
      notify(failure.message, 'error')
      return
    }
    notify('Evento cerrado.', 'success')
    setConfirming(false)
    reconciliation.reload()
    onClosed()
  }

  return (
    <div className="space-y-5">
      <p className="hint">
        Lo llevado no cambia el stock propio: es un traslado. Al cerrar se compara el conteo físico contra lo esperado
        (llevado − vendido − regalado) y las diferencias quedan registradas con su motivo.
      </p>

      {!closed && (
        <form onSubmit={carry} className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4">
          <div className="min-w-56 flex-1">
            <label htmlFor="carry-variant" className="label">Variante que se lleva</label>
            <select id="carry-variant" required className="input" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
              <option value="">Elegí una</option>
              {catalog.items.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label htmlFor="carry-qty" className="label">Cantidad</label>
            <input id="carry-qty" type="number" min={1} required className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <button type="submit" className="btn">Registrar salida</button>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SearchBox id="carried-search" label="Buscar variante llevada" placeholder="Buscar variante" value={search} onChange={(v) => { setSearch(v); paging.setPage(0) }} />
        <span className="chip chip-off">{carriedRows.length} llevadas</span>
      </div>

      {carriedRows.length === 0 && <p className="hint">Todavía no se registró stock llevado.</p>}
      {carriedRows.length > 0 && shown.length === 0 && <p className="hint">Ninguna variante coincide.</p>}
      {shown.length > 0 && (
        <ul className="rounded-xl border border-line bg-white">
          {paging.paged.map((r) => (
            <li key={r.variant_id} className="space-y-2 border-t border-line px-4 py-3 first:border-t-0">
              <div>
                <p className="text-sm font-medium">{label(r.variant_id)}</p>
                <p className="hint">Llevado {r.carried} · Vendido {r.sold} · Regalado {r.gifted} · Esperado {r.expected_remaining}</p>
              </div>
              {closed ? (
                <p className="text-sm">
                  Contado {r.counted ?? '—'}
                  {r.difference ? ` (${r.difference > 0 ? '+' : ''}${r.difference})` : ''}
                  {r.note ? ` · ${r.note}` : ''}
                </p>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-24">
                    <label className="label" htmlFor={`count-${r.variant_id}`}>Contado</label>
                    <input id={`count-${r.variant_id}`} type="number" min={0} className="input" value={countFor(r)} onChange={(e) => setCounts({ ...counts, [r.variant_id]: e.target.value })} />
                  </div>
                  <p role="status" className={`min-h-11 w-28 pb-2.5 pt-3 text-sm ${Number(countFor(r)) === r.expected_remaining ? 'text-muted' : 'text-danger'}`}>
                    {differenceText(Number(countFor(r)) - r.expected_remaining)}
                  </p>
                  <div className="min-w-44 flex-1">
                    <label className="label" htmlFor={`note-${r.variant_id}`}>Motivo si hay diferencia</label>
                    <input id={`note-${r.variant_id}`} className="input" value={notes[r.variant_id] ?? ''} onChange={(e) => setNotes({ ...notes, [r.variant_id]: e.target.value })} />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Pager paging={paging} label="variantes llevadas" id="carried-page-size" />

      {otherRows.length > 0 && (
        <p className="hint">
          Con ventas pero sin salida registrada (no se concilian): {otherRows.map((r) => `${label(r.variant_id)} (${r.sold + r.gifted})`).join(', ')}.
        </p>
      )}

      {!closed && (
        <div className="border-t border-line pt-5">
          <button type="button" className="btn" onClick={() => setConfirming(true)}>Cerrar evento</button>
        </div>
      )}

      <Modal open={confirming} title="Cerrar evento" onClose={() => !closing && setConfirming(false)}>
        <div className="space-y-4">
          <p>Vas a cerrar <strong>{event.code} · {event.name}</strong> con el conteo actual de {carriedRows.length} {carriedRows.length === 1 ? 'variante' : 'variantes'}.</p>
          <p className="text-sm text-danger">Un evento cerrado ya no se puede editar ni volver a abrir.</p>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-quiet" disabled={closing} onClick={() => setConfirming(false)}>Cancelar</button>
            <button type="button" className="btn" disabled={closing} onClick={() => void close()}>{closing ? 'Cerrando…' : 'Cerrar evento'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
