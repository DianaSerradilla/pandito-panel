import { useState } from 'react'
import { useVariantCatalog } from '../../data/useVariantCatalog.ts'
import { CalendarPanel } from './CalendarPanel.tsx'
import { PromoSales, TopStickers } from './SalesRankings.tsx'
import { useSalesStats } from './useSalesStats.ts'

const periods = [
  { value: 'all', label: 'Todo', days: 0 },
  { value: '90', label: '90 días', days: 90 },
  { value: '30', label: '30 días', days: 30 },
] as const

const money = (value: number) => `$ ${value.toLocaleString('es-AR')}`

/** Home: how sales are going and what is coming up that is worth selling around. */
export function HomePage() {
  const [period, setPeriod] = useState<(typeof periods)[number]['value']>('all')
  const days = periods.find((p) => p.value === period)?.days ?? 0
  // Whole days back from this morning, so the value is stable between renders.
  const [dayStart] = useState(() => new Date(new Date().toDateString()).getTime())
  const since = days ? new Date(dayStart - days * 86_400_000).toISOString() : ''
  const stats = useSalesStats(since)
  const catalog = useVariantCatalog()

  const sold = stats.tickets
  const units = sold.reduce((sum, t) => sum + t.ticket_items.reduce((s, l) => s + l.quantity, 0), 0)
  const income = sold.reduce((sum, t) => sum + t.total, 0)
  const promos = sold.reduce((sum, t) => sum + (t.promo_snapshot?.promotions ?? []).reduce((s, p) => s + (p.times ?? 1), 0), 0)
  const tiles = [
    { label: 'Ventas', value: String(sold.length) },
    { label: 'Stickers vendidos', value: String(units) },
    { label: 'Ingresos', value: money(income) },
    { label: 'Promos vendidas', value: String(promos) },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inicio</h1>
          <p className="hint">Salen de las ventas registradas en eventos (no cuentan regalos, pérdidas ni anulados).</p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Período">
          {periods.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={period === p.value}
              onClick={() => setPeriod(p.value)}
              className={`min-h-11 rounded-xl border-2 px-4 text-sm font-semibold ${period === p.value ? 'border-tinta bg-tinta text-crema' : 'border-line bg-white'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {stats.error && <p className="error" role="alert">{stats.error}</p>}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-line bg-white px-4 py-3">
            <dt className="text-sm text-muted">{tile.label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{stats.loading ? '…' : tile.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-2">
        <TopStickers tickets={sold} items={catalog.items} loading={stats.loading || catalog.loading} />
        <PromoSales tickets={sold} loading={stats.loading} />
      </div>

      <CalendarPanel />
    </div>
  )
}
