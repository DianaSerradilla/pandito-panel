import { useState, type FormEvent } from 'react'
import type { EventRow } from '../../data/types.ts'
import { ExportButtons } from '../../components/ExportButtons.tsx'
import { Thumb } from '../../components/Thumb.tsx'
import { useCovers } from '../../data/useCovers.ts'
import { useRows } from '../../data/useRows.ts'
import { useVariantCatalog } from '../../data/useVariantCatalog.ts'
import { useToast } from '../../components/toast.ts'
import { supabase } from '../../lib/supabase.ts'

interface StockRow {
  variant_id: string
  sku: string
  on_hand: number
  intake: number
  sold: number
  reserved: number
  display: number
  gifted: number
  damaged: number
  missing: number
  adjustment: number
  needs_restock: boolean
}

interface MovementRow {
  id: number
  occurred_at: string
  variant_id: string
  type: string
  quantity: number
  note: string | null
  created_by: string | null
  event_id: string | null
}

interface StaffRow {
  user_id: string
  display_name: string
}

// Manual movements only. Sales and gifts come from tickets, trips to events from Eventos.
// Reservations are designed but not enabled in the MVP (REQ-PI-INVENTORY-009).
// sign: how the typed (positive) quantity is stored. 0 means the user picks the direction.
const manualTypes = [
  { value: 'intake', label: 'Ingreso (reposición)', sign: 1 },
  { value: 'adjustment', label: 'Ajuste por conteo', sign: 0 },
  { value: 'display', label: 'Exhibición', sign: -1 },
  { value: 'damaged', label: 'Dañado', sign: -1 },
  { value: 'missing', label: 'Faltante', sign: -1 },
] as const

const typeLabels: Record<string, string> = {
  ...Object.fromEntries(manualTypes.map((t) => [t.value, t.label])),
  sale: 'Venta',
  gift: 'Regalo',
  reservation: 'Reserva',
  reservation_release: 'Liberación de reserva',
  reversal: 'Anulación',
  event_out: 'Salida a evento',
  event_return: 'Vuelta de evento',
}

function MovementForm({ onSaved }: { onSaved: () => void }) {
  const catalog = useVariantCatalog()
  const [variantId, setVariantId] = useState('')
  const [type, setType] = useState<(typeof manualTypes)[number]['value']>('intake')
  const [direction, setDirection] = useState<1 | -1>(1)
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const { notify } = useToast()

  const rule = manualTypes.find((t) => t.value === type)!
  const needsNote = type === 'adjustment' || type === 'damaged' || type === 'missing'

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const sign = rule.sign === 0 ? direction : rule.sign
    const { error: failure } = await supabase
      .from('stock_movements')
      .insert({ variant_id: variantId, type, quantity: sign * Number(quantity), note: note.trim() || null })
    if (failure) {
      notify(failure.message, 'error')
      return
    }
    notify('Movimiento registrado.', 'success')
    {
      setQuantity('')
      setNote('')
      onSaved()
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4" aria-labelledby="move-title">
      <h2 id="move-title" className="text-lg font-semibold">Registrar movimiento</h2>
      <p className="hint">Los movimientos no se editan ni se borran: si te equivocás, registrá un ajuste con el motivo.</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1">
          <label htmlFor="mv-variant" className="label">Variante</label>
          <select id="mv-variant" required className="input" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
            <option value="">Elegí una</option>
            {catalog.items.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>
        <div className="w-56">
          <label htmlFor="mv-type" className="label">Tipo</label>
          <select id="mv-type" className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {manualTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        {rule.sign === 0 && (
          <div className="w-32">
            <label htmlFor="mv-dir" className="label">Diferencia</label>
            <select id="mv-dir" className="input" value={direction} onChange={(e) => setDirection(Number(e.target.value) as 1 | -1)}>
              <option value={1}>Sobran (+)</option>
              <option value={-1}>Faltan (−)</option>
            </select>
          </div>
        )}
        <div className="w-28">
          <label htmlFor="mv-qty" className="label">Cantidad</label>
          <input id="mv-qty" type="number" min={1} required className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
      </div>
      <div>
        <label htmlFor="mv-note" className="label">Motivo o nota{needsNote ? '' : ' (opcional)'}</label>
        <input id="mv-note" required={needsNote} className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button type="submit" className="btn">Registrar</button>
    </form>
  )
}

export function StockPage() {
  const catalog = useVariantCatalog()
  const stock = useRows<StockRow>('variant_stock')
  const { covers } = useCovers()
  const movements = useRows<MovementRow>('stock_movements', ['id'])
  const [onlyRestock, setOnlyRestock] = useState(false)
  const [search, setSearch] = useState('')
  const staff = useRows<StaffRow>('staff')
  const events = useRows<EventRow>('events')
  const [fVariant, setFVariant] = useState('')
  const [fType, setFType] = useState('')
  const [fUser, setFUser] = useState('')
  const [fEvent, setFEvent] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')

  const label = (id: string) => catalog.items.find((i) => i.id === id)?.label ?? id
  const cover = (id: string) => covers.get(catalog.items.find((i) => i.id === id)?.productId ?? '')
  const query = search.trim().toLowerCase()
  const rows = stock.rows
    .filter((r) => (!onlyRestock || r.needs_restock) && (!query || `${r.sku} ${label(r.variant_id)}`.toLowerCase().includes(query)))
    .sort((a, b) => label(a.variant_id).localeCompare(label(b.variant_id)))
  const day = (iso: string) => new Date(iso).toLocaleDateString('sv-SE') // yyyy-mm-dd, local time
  const recent = [...movements.rows]
    .reverse()
    .filter(
      (m) =>
        (!fVariant || m.variant_id === fVariant) &&
        (!fType || m.type === fType) &&
        (!fUser || m.created_by === fUser) &&
        (!fEvent || m.event_id === fEvent) &&
        (!fFrom || day(m.occurred_at) >= fFrom) &&
        (!fTo || day(m.occurred_at) <= fTo),
    )
    .slice(0, 100)
  const userName = (id: string | null) => staff.rows.find((s) => s.user_id === id)?.display_name ?? null
  const eventCode = (id: string | null) => events.rows.find((e) => e.id === id)?.code ?? null
  const reloadAll = () => {
    stock.reload()
    movements.reload()
  }

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Stock</h1>
      <p className="hint">
        El stock es la suma de movimientos. Hoy todo se vende a pedido, así que puede quedar en cero o negativo sin que la web lo muestre.
      </p>

      <MovementForm onSaved={reloadAll} />

      <section className="card space-y-3" aria-labelledby="stock-title">
        <h2 id="stock-title" className="text-lg font-semibold">Stock por variante</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label htmlFor="stock-search" className="label">Buscar</label>
            <input id="stock-search" type="search" className="input" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyRestock} onChange={(e) => setOnlyRestock(e.target.checked)} />
            Solo para reponer
          </label>
        </div>
        {stock.error && <p className="error" role="alert">{stock.error}</p>}
        {!stock.loading && rows.length === 0 && <p className="hint">No hay variantes para mostrar.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Stock por variante</caption>
            <thead>
              <tr className="text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Variante</th>
                <th scope="col" className="px-2 font-medium">Stock</th>
                <th scope="col" className="px-2 font-medium">Ingresó</th>
                <th scope="col" className="px-2 font-medium">Vendido</th>
                <th scope="col" className="px-2 font-medium">Exhib.</th>
                <th scope="col" className="px-2 font-medium">Regalo</th>
                <th scope="col" className="px-2 font-medium">Dañado</th>
                <th scope="col" className="px-2 font-medium">Faltante</th>
                <th scope="col" className="px-2 font-medium">Ajuste</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.variant_id} className="border-t border-line">
                  <th scope="row" className="flex items-center gap-3 py-2 pr-3 font-normal">
                    <Thumb path={cover(r.variant_id)} size={40} />
                    <span>{label(r.variant_id)}</span>
                    {r.needs_restock && <span className="ml-2 rounded bg-red-50 px-1.5 text-danger">Reponer</span>}
                  </th>
                  <td className="px-2 font-semibold">{r.on_hand}</td>
                  <td className="px-2">{r.intake}</td>
                  <td className="px-2">{r.sold}</td>
                  <td className="px-2">{r.display}</td>
                  <td className="px-2">{r.gifted}</td>
                  <td className="px-2">{r.damaged}</td>
                  <td className="px-2">{r.missing}</td>
                  <td className="px-2">{r.adjustment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="history-title">
        <h2 id="history-title" className="mb-2 text-lg font-semibold">Historial de movimientos</h2>
        <div className="mb-4"><ExportButtons /></div>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label htmlFor="h-variant" className="label">Variante</label>
            <select id="h-variant" className="input" value={fVariant} onChange={(e) => setFVariant(e.target.value)}>
              <option value="">Todas</option>
              {catalog.items.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
            </select>
          </div>
          <div className="w-44">
            <label htmlFor="h-type" className="label">Tipo</label>
            <select id="h-type" className="input" value={fType} onChange={(e) => setFType(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(typeLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </div>
          <div className="w-40">
            <label htmlFor="h-user" className="label">Usuario</label>
            <select id="h-user" className="input" value={fUser} onChange={(e) => setFUser(e.target.value)}>
              <option value="">Todos</option>
              {staff.rows.map((s) => <option key={s.user_id} value={s.user_id}>{s.display_name}</option>)}
            </select>
          </div>
          <div className="w-40">
            <label htmlFor="h-event" className="label">Evento</label>
            <select id="h-event" className="input" value={fEvent} onChange={(e) => setFEvent(e.target.value)}>
              <option value="">Todos</option>
              {events.rows.map((e) => <option key={e.id} value={e.id}>{e.code}</option>)}
            </select>
          </div>
          <div className="w-40">
            <label htmlFor="h-from" className="label">Desde</label>
            <input id="h-from" type="date" className="input" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          </div>
          <div className="w-40">
            <label htmlFor="h-to" className="label">Hasta</label>
            <input id="h-to" type="date" className="input" value={fTo} onChange={(e) => setFTo(e.target.value)} />
          </div>
        </div>
        {recent.length === 0 && <p className="hint">No hay movimientos para estos filtros.</p>}
        <ul>
          {recent.map((m) => (
            <li key={m.id} className="border-t border-line py-2 text-sm first:border-t-0">
              <span className="text-muted">{new Date(m.occurred_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              {' · '}{typeLabels[m.type] ?? m.type}{' · '}
              <span className="font-medium">{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</span>
              {' · '}{label(m.variant_id)}
              {eventCode(m.event_id) ? ` · ${eventCode(m.event_id)}` : ''}
              {userName(m.created_by) ? ` · ${userName(m.created_by)}` : ''}
              {m.note ? ` · ${m.note}` : ''}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
