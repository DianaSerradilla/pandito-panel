import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal.tsx'
import { Pager } from '../../components/Pager.tsx'
import { SearchBox } from '../../components/SearchBox.tsx'
import { Thumb } from '../../components/Thumb.tsx'
import { usePaging } from '../../components/usePaging.ts'
import { useToast } from '../../components/toast.ts'
import type { OrderSource } from '../../data/types.ts'
import { useCovers } from '../../data/useCovers.ts'
import { useVariantCatalog } from '../../data/useVariantCatalog.ts'
import { supabase } from '../../lib/supabase.ts'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const money = (value: number) => `$ ${value.toLocaleString('es-AR')}`
const stepper = 'inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-xl font-semibold leading-none'

/** Creates a request with its stickers in one step: who asked, what they asked for. */
export function NewRequestModal({ open, onClose, onCreated }: Props) {
  const catalog = useVariantCatalog()
  const { covers } = useCovers()
  const { notify } = useToast()
  const [source, setSource] = useState<OrderSource>('whatsapp')
  const [customer, setCustomer] = useState('')
  const [contact, setContact] = useState('')
  const [notes, setNotes] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  const needle = search.trim().toLowerCase()
  const available = catalog.items.filter(
    (i) => i.published && i.fulfillment !== 'unavailable' && i.price !== null && (!needle || i.label.toLowerCase().includes(needle)),
  )
  const paging = usePaging(available, 5)
  const chosen = catalog.items.filter((i) => (quantities[i.id] ?? 0) > 0)
  const units = chosen.reduce((sum, i) => sum + (quantities[i.id] ?? 0), 0)
  const total = chosen.reduce((sum, i) => sum + (quantities[i.id] ?? 0) * (i.price ?? 0), 0)

  const change = (id: string, delta: number) =>
    setQuantities((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }))

  function reset() {
    setSource('whatsapp')
    setCustomer('')
    setContact('')
    setNotes('')
    setQuantities({})
    setSearch('')
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    if (chosen.length === 0) {
      notify('Elegí al menos un sticker.', 'error')
      return
    }
    setBusy(true)
    const { data, error: failure } = await supabase
      .from('orders')
      .insert({ source, customer_name: customer.trim() || null, contact_ref: contact.trim() || null, notes: notes.trim() || null })
      .select('id')
      .single()
    if (failure || !data) {
      setBusy(false)
      notify(failure?.message ?? 'No se pudo crear la solicitud.', 'error')
      return
    }
    const lines = chosen.map((i) => ({ order_id: data.id as string, variant_id: i.id, quantity: quantities[i.id] ?? 0, unit_price: i.price ?? 0 }))
    const { error: linesFailure } = await supabase.from('order_items').insert(lines)
    setBusy(false)
    onCreated()
    if (linesFailure) {
      notify(`La solicitud se creó, pero no sus stickers: ${linesFailure.message}`, 'error')
      onClose()
      return
    }
    notify('Solicitud creada.', 'success')
    reset()
    onClose()
  }

  return (
    <Modal open={open} title="Nueva solicitud" onClose={onClose} wide>
      <form onSubmit={create} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="order-source">Origen</label>
            <select id="order-source" className="input" value={source} onChange={(e) => setSource(e.target.value as OrderSource)}>
              <option value="whatsapp">WhatsApp</option>
              <option value="manual">Manual</option>
              <option value="event">Evento</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="order-customer">Cliente</label>
            <input id="order-customer" className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="order-contact">WhatsApp o contacto</label>
            <input id="order-contact" className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold">Stickers pedidos</h3>
          <SearchBox id="order-sticker-search" label="Buscar sticker" placeholder="Buscar sticker" value={search} onChange={(v) => { setSearch(v); paging.setPage(0) }} />
          {catalog.loading && <p className="hint">Cargando stickers…</p>}
          {!catalog.loading && available.length === 0 && <p className="hint">No hay stickers activos con precio que coincidan.</p>}
          <ul className="rounded-2xl border border-line bg-white">
            {paging.paged.map((item) => {
              const qty = quantities[item.id] ?? 0
              return (
                <li key={item.id} className={`flex items-center gap-3 border-t border-line p-2 first:border-t-0 ${qty ? 'bg-crema' : ''}`}>
                  <Thumb path={covers.get(item.productId)} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.productName}</span>
                    <span className="block truncate text-sm text-muted">{item.sizeName} · {item.materialName} · {item.finishName}</span>
                    <span className="block text-sm font-semibold">{money(item.price ?? 0)}</span>
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    {qty > 0 && (
                      <>
                        <button type="button" className={`${stepper} border-2 border-line bg-white`} aria-label={`Quitar uno de ${item.productName}`} onClick={() => change(item.id, -1)}>−</button>
                        <span className="w-7 text-center font-semibold" aria-live="polite">{qty}</span>
                      </>
                    )}
                    <button type="button" className={`${stepper} bg-naranja-dark text-white`} aria-label={`Sumar uno de ${item.productName}`} onClick={() => change(item.id, 1)}>+</button>
                  </div>
                </li>
              )
            })}
          </ul>
          <Pager paging={paging} label="stickers" id="order-sticker-page-size" />
        </div>

        <div>
          <label className="label" htmlFor="order-notes">Nota (opcional)</label>
          <input id="order-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">
            {units} {units === 1 ? 'sticker' : 'stickers'} · {money(total)}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button type="button" className="btn-quiet min-h-11" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn min-h-11" disabled={busy || units === 0}>{busy ? 'Creando…' : 'Crear solicitud'}</button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
