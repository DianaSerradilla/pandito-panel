import { useState } from 'react'
import { Link } from 'react-router'
import { useToast } from '../../components/toast.ts'
import { supabase } from '../../lib/supabase.ts'
import { Pager } from '../../components/Pager.tsx'
import { Pill } from '../../components/Pill.tsx'
import { SearchBox } from '../../components/SearchBox.tsx'
import { usePaging } from '../../components/usePaging.ts'
import type { OrderRow, OrderStatus } from '../../data/types.ts'
import { useRows } from '../../data/useRows.ts'
import { NewRequestModal } from './NewRequestModal.tsx'
import { advanceTo, orderCode, sourceLabel, statusLabel, statusTone } from '../orders/orderStatus.ts'

type Filter = 'open' | 'all' | OrderStatus

const nowIso = () => new Date().toISOString()
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Requests from the web, WhatsApp or loaded by hand: a table with search, a status filter and a modal to create. */
export function RequestsTab() {
  const orders = useRows<OrderRow>('orders')
  const { notify } = useToast()
  const [filter, setFilter] = useState<Filter>('open')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)

  const needle = search.trim().toLowerCase()
  const visible = [...orders.rows]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .filter((o) => (filter === 'all' ? true : filter === 'open' ? o.status === 'requested' || o.status === 'answered' : o.status === filter))
    .filter((o) => !needle || `${orderCode(o.number)} ${o.customer_name ?? ''} ${sourceLabel[o.source]}`.toLowerCase().includes(needle))
  const paging = usePaging(visible, 10)

  async function advance(order: OrderRow) {
    const next = advanceTo[order.status]
    if (!supabase || !next) return
    const { error: failure } = await supabase
      .from('orders')
      .update({ status: next, completed_at: next === 'delivered' ? nowIso() : null })
      .eq('id', order.id)
    if (failure) {
      notify(failure.message, 'error')
      return
    }
    notify(`${orderCode(order.number)}: ${statusLabel[next]}`, 'success')
    orders.reload()
  }

  return (
    <section aria-label="Solicitudes" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-end gap-3">
          <SearchBox id="requests-search" label="Buscar solicitud" placeholder="Código o cliente" value={search} onChange={setSearch} />
          <div className="w-44">
            <label className="label" htmlFor="requests-filter">Mostrar</label>
            <select id="requests-filter" className="input" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              <option value="open">Abiertas</option>
              <option value="all">Todas</option>
              {(Object.keys(statusLabel) as OrderStatus[]).map((s) => (
                <option key={s} value={s}>{statusLabel[s]}</option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" className="btn min-h-11" onClick={() => setAdding(true)}>Nueva solicitud</button>
      </div>

      {orders.error && <p className="error" role="alert">{orders.error}</p>}
      {!orders.loading && visible.length === 0 && <p className="hint">No hay solicitudes con este filtro.</p>}

      {visible.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Origen</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paging.paged.map((o) => (
                <tr key={o.id}>
                  <td className="font-medium">{orderCode(o.number)}</td>
                  <td>{o.customer_name ?? 'Sin nombre'}</td>
                  <td>{sourceLabel[o.source]}</td>
                  <td className="whitespace-nowrap">{dateTime(o.created_at)}</td>
                  <td><Pill tone={statusTone[o.status]}>{statusLabel[o.status]}</Pill></td>
                  <td className="whitespace-nowrap text-right">
                    {advanceTo[o.status] && (
                      <button
                        type="button"
                        title={`Marcar ${statusLabel[advanceTo[o.status] ?? 'answered'].toLowerCase()}`}
                        aria-label={`Marcar ${orderCode(o.number)} como ${statusLabel[advanceTo[o.status] ?? 'answered'].toLowerCase()}`}
                        className="inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-crema hover:text-tinta"
                        onClick={() => void advance(o)}
                      >
                        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      </button>
                    )}
                    <Link
                      to={`/pedidos/solicitudes/${o.id}`}
                      aria-label={`Abrir ${orderCode(o.number)}`}
                      title="Abrir"
                      className="inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-crema hover:text-tinta"
                    >
                      <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager paging={paging} label="solicitudes" id="requests-page-size" />

      <NewRequestModal open={adding} onClose={() => setAdding(false)} onCreated={orders.reload} />
    </section>
  )
}
