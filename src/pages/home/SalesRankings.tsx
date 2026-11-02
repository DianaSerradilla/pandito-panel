import { Pager } from '../../components/Pager.tsx'
import { usePaging } from '../../components/usePaging.ts'
import type { VariantInfo } from '../../data/useVariantCatalog.ts'
import type { SaleTicket } from './useSalesStats.ts'

const money = (value: number) => `$ ${value.toLocaleString('es-AR')}`
const card = 'space-y-4 rounded-2xl border border-line bg-white p-4 sm:p-5'

/** Designs ranked by units sold, with a bar proportional to the best seller. */
export function TopStickers({ tickets, items, loading }: { tickets: SaleTicket[]; items: VariantInfo[]; loading: boolean }) {
  const productOf = new Map(items.map((i) => [i.id, i]))

  const totals = new Map<string, { name: string; code: string; units: number; revenue: number }>()
  for (const ticket of tickets) {
    for (const line of ticket.ticket_items) {
      const info = productOf.get(line.variant_id)
      const key = info?.productId ?? 'removed'
      const row = totals.get(key) ?? { name: info?.productName ?? 'Sticker eliminado', code: info?.productCode ?? '', units: 0, revenue: 0 }
      row.units += line.quantity
      row.revenue += line.line_total
      totals.set(key, row)
    }
  }
  const ranking = [...totals.values()].sort((a, b) => b.units - a.units)
  const best = ranking[0]?.units ?? 1
  const shown = ranking.map((row, index) => ({ ...row, rank: index + 1 }))
  const paging = usePaging(shown, 10)

  return (
    <section className={card} aria-labelledby="top-stickers">
      <div>
        <h2 id="top-stickers" className="text-lg font-semibold">Stickers más vendidos</h2>
      </div>
      {loading && <p className="hint">Calculando…</p>}
      {!loading && ranking.length === 0 && <p className="hint">Todavía no hay ventas en este período.</p>}
      <ol className="space-y-3">
        {paging.paged.map((row) => (
          <li key={row.rank} className="space-y-1">
            <div className="flex items-baseline gap-3">
              <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-muted">{row.rank}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{row.units} {row.units === 1 ? 'unidad' : 'unidades'}</span>
            </div>
            <div className="flex items-center gap-3 pl-9">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-crema" aria-hidden>
                <div className="h-full rounded-full bg-naranja-dark" style={{ width: `${Math.max(4, (row.units / best) * 100)}%` }} />
              </div>
              <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted">{money(row.revenue)}</span>
            </div>
          </li>
        ))}
      </ol>
      <Pager paging={paging} label="stickers más vendidos" id="top-page-size" />
    </section>
  )
}

/** Promotions applied to sold tickets: how many times each one was sold and how much it discounted. */
export function PromoSales({ tickets, loading }: { tickets: SaleTicket[]; loading: boolean }) {
  const totals = new Map<string, { name: string; sold: number; tickets: number; discount: number }>()
  for (const ticket of tickets) {
    for (const promo of ticket.promo_snapshot?.promotions ?? []) {
      const key = promo.id ?? promo.name
      const row = totals.get(key) ?? { name: promo.name, sold: 0, tickets: 0, discount: 0 }
      row.sold += promo.times ?? 1
      row.tickets += 1
      row.discount += promo.discount ?? 0
      totals.set(key, row)
    }
  }
  const ranking = [...totals.values()].sort((a, b) => b.sold - a.sold)
  const shown = ranking
  const paging = usePaging(shown, 10)

  return (
    <section className={card} aria-labelledby="promo-sales">
      <div>
        <h2 id="promo-sales" className="text-lg font-semibold">Promos vendidas</h2>
      </div>
      {loading && <p className="hint">Calculando…</p>}
      {!loading && ranking.length === 0 && <p className="hint">Todavía no se vendió ninguna promo en este período.</p>}
      {shown.length > 0 && (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Promo</th>
                <th className="text-right">Vendidas</th>
                <th className="text-right">Descontado</th>
              </tr>
            </thead>
            <tbody>
              {paging.paged.map((row) => (
                <tr key={row.name}>
                  <td className="font-medium">{row.name}</td>
                  <td className="text-right tabular-nums">{row.sold}</td>
                  <td className="text-right tabular-nums">{money(row.discount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager paging={paging} label="promos vendidas" id="promo-page-size" />
    </section>
  )
}
