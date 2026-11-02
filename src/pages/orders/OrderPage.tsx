import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import type { DeliverySlot, OrderItem, OrderRow, OrderStatus } from '../../data/types.ts'
import { useRows } from '../../data/useRows.ts'
import { useVariantCatalog } from '../../data/useVariantCatalog.ts'
import { useToast } from '../../components/toast.ts'
import { supabase } from '../../lib/supabase.ts'
import { nextStatuses, orderCode, sourceLabel, statusLabel } from './orderStatus.ts'

const money = (value: number) => `$ ${value.toLocaleString('es-AR')}`
const nowIso = () => new Date().toISOString()
const slotLabel = (s: DeliverySlot) => `${s.slot_date} · ${s.starts_at.slice(0, 5)}–${s.ends_at.slice(0, 5)}`

export function OrderPage() {
  const { orderId = '' } = useParams()
  const orders = useRows<OrderRow>('orders')
  const items = useRows<OrderItem>('order_items')
  const slots = useRows<DeliverySlot>('delivery_slots', ['slot_date', 'starts_at'])
  const catalog = useVariantCatalog()
  const order = orders.rows.find((o) => o.id === orderId)
  const lines = items.rows.filter((i) => i.order_id === orderId)
  const editable = order ? order.status === 'requested' || order.status === 'answered' : false

  const { notify } = useToast()
  const [reason, setReason] = useState('')
  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [search, setSearch] = useState('')

  if (orders.loading) return <p className="hint" role="status">Cargando…</p>
  if (!order) return <p className="error" role="alert">No se encontró la solicitud. <Link to="/pedidos">Volver al listado</Link></p>

  const total = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0)
  const report = (error: { message: string } | null, ok = 'Guardado.') => (error ? notify(error.message, 'error') : notify(ok, 'success'))

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !order) return
    const form = new FormData(event.currentTarget)
    const text = (key: string) => String(form.get(key) ?? '').trim() || null
    const agreed = text('agreed')
    const agreedTotal = agreed === null ? null : Number(agreed.replace(',', '.'))
    if (agreedTotal !== null && (!Number.isFinite(agreedTotal) || agreedTotal < 0)) {
      notify('Ingresá un total acordado válido.', 'error')
      return
    }
    const { error } = await supabase
      .from('orders')
      .update({
        customer_name: text('customer'),
        contact_ref: text('contact'),
        delivery_slot_id: text('slot'),
        agreed_total: agreedTotal,
        notes: text('notes'),
      })
      .eq('id', order.id)
    report(error)
    if (!error) orders.reload()
  }

  async function changeStatus(next: OrderStatus) {
    if (!supabase || !order) return
    if (next === 'cancelled' && !reason.trim()) {
      notify('Escribí el motivo de la cancelación.', 'error')
      return
    }
    const { error } = await supabase
      .from('orders')
      .update({
        status: next,
        cancelled_reason: next === 'cancelled' ? reason.trim() : null,
        completed_at: next === 'delivered' ? nowIso() : null,
      })
      .eq('id', order.id)
    report(error, `Estado: ${statusLabel[next]}`)
    if (!error) orders.reload()
  }

  async function addItem(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !order) return
    const variant = catalog.items.find((v) => v.id === variantId)
    const qty = Number(quantity)
    if (!variant) return notify('Elegí una variante.', 'error')
    if (variant.price === null) return notify('Esa variante no tiene precio cargado.', 'error')
    if (!Number.isInteger(qty) || qty < 1) return notify('La cantidad tiene que ser un entero desde 1.', 'error')
    const { error } = await supabase
      .from('order_items')
      .insert({ order_id: order.id, variant_id: variant.id, quantity: qty, unit_price: variant.price })
    report(error, 'Producto agregado')
    if (!error) {
      setVariantId('')
      setQuantity('1')
      items.reload()
    }
  }

  async function removeItem(id: string) {
    if (!supabase) return
    const { error } = await supabase.from('order_items').delete().eq('id', id)
    report(error, 'Producto quitado')
    if (!error) items.reload()
  }

  const needle = search.trim().toLowerCase()
  const options = catalog.items.filter((v) => !needle || v.label.toLowerCase().includes(needle)).slice(0, 50)

  return (
    <div className="space-y-6">
      <p><Link to="/pedidos">← Solicitudes</Link></p>
      <h1 className="text-2xl font-semibold">
        {orderCode(order.number)} · {statusLabel[order.status]}
      </h1>
      <p className="hint">
        Origen: {sourceLabel[order.source]} · Creada {new Date(order.created_at).toLocaleString('es-AR')}
        {order.cancelled_reason ? ` · Motivo de cancelación: ${order.cancelled_reason}` : ''}
      </p>

      <form onSubmit={saveDetails} className="card space-y-3" aria-labelledby="details-title">
        <h2 id="details-title" className="text-lg font-semibold">Datos</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-44 flex-1">
            <label className="label" htmlFor="o-customer">Cliente</label>
            <input id="o-customer" name="customer" className="input" defaultValue={order.customer_name ?? ''} disabled={!editable} />
          </div>
          <div className="min-w-44 flex-1">
            <label className="label" htmlFor="o-contact">Enlace o referencia de WhatsApp</label>
            <input id="o-contact" name="contact" className="input" defaultValue={order.contact_ref ?? ''} disabled={!editable} />
          </div>
          <div className="min-w-56">
            <label className="label" htmlFor="o-slot">Franja de entrega</label>
            <select id="o-slot" name="slot" className="input" defaultValue={order.delivery_slot_id ?? ''} disabled={!editable}>
              <option value="">Sin franja</option>
              {slots.rows.map((s) => <option key={s.id} value={s.id}>{slotLabel(s)}{s.active ? '' : ' (inactiva)'}</option>)}
            </select>
          </div>
          <div className="w-36">
            <label className="label" htmlFor="o-agreed">Total acordado</label>
            <input id="o-agreed" name="agreed" inputMode="decimal" className="input" defaultValue={order.agreed_total ?? ''} disabled={!editable} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="o-notes">Notas</label>
          <textarea id="o-notes" name="notes" rows={2} className="input" defaultValue={order.notes ?? ''} disabled={!editable} />
        </div>
        {editable && <button type="submit" className="btn-quiet">Guardar datos</button>}
      </form>

      <section className="card space-y-3" aria-labelledby="lines-title">
        <h2 id="lines-title" className="text-lg font-semibold">Productos</h2>
        {!items.loading && lines.length === 0 && <p className="hint">Todavía no hay productos en esta solicitud.</p>}
        <ul>
          {lines.map((l) => {
            const v = catalog.items.find((x) => x.id === l.variant_id)
            return (
              <li key={l.id} className="flex flex-wrap items-center gap-3 border-t border-line py-2 first:border-t-0">
                <span className="min-w-56 flex-1">{v?.label ?? l.variant_id}</span>
                <span>{l.quantity} × {money(l.unit_price)}</span>
                <span className="w-24 text-right">{money(l.quantity * l.unit_price)}</span>
                {editable && <button type="button" className="btn-quiet" onClick={() => void removeItem(l.id)}>Quitar</button>}
              </li>
            )
          })}
        </ul>
        <p className="text-right font-medium">Total por lista: {money(total)}</p>

        {editable && (
          <form onSubmit={addItem} className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
            <div className="w-48">
              <label className="label" htmlFor="o-search">Buscar</label>
              <input id="o-search" className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Código o nombre" />
            </div>
            <div className="min-w-64 flex-1">
              <label className="label" htmlFor="o-variant">Variante</label>
              <select id="o-variant" className="input" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                <option value="">Elegí una variante</option>
                {options.map((v) => <option key={v.id} value={v.id}>{v.label}{v.price === null ? ' (sin precio)' : ` · ${money(v.price)}`}</option>)}
              </select>
            </div>
            <div className="w-24">
              <label className="label" htmlFor="o-qty">Cantidad</label>
              <input id="o-qty" type="number" min={1} className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <button type="submit" className="btn">Agregar</button>
          </form>
        )}
      </section>

      {nextStatuses[order.status].length > 0 && (
        <section className="card space-y-3" aria-labelledby="status-title">
          <h2 id="status-title" className="text-lg font-semibold">Estado</h2>
          <p className="hint">Cambiar el estado es una decisión del equipo y no mueve stock.</p>
          <div className="flex flex-wrap items-end gap-3">
            {nextStatuses[order.status].filter((s) => s !== 'cancelled').map((s, index) => (
              <button key={s} type="button" className={index === 0 ? 'btn' : 'btn-quiet'} onClick={() => void changeStatus(s)}>
                {order.status === 'cancelled' ? 'Reabrir como solicitado' : `Pasar a ${statusLabel[s].toLowerCase()}`}
              </button>
            ))}
            {nextStatuses[order.status].includes('cancelled') && (
              <>
                <div className="min-w-56 flex-1">
                  <label className="label" htmlFor="o-reason">Motivo de cancelación</label>
                  <input id="o-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                <button type="button" className="btn-quiet" onClick={() => void changeStatus('cancelled')}>Cancelar solicitud</button>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
