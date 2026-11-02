import { useState } from 'react'
import { Link } from 'react-router'
import { Pager } from '../../components/Pager.tsx'
import { SearchBox } from '../../components/SearchBox.tsx'
import { Thumb } from '../../components/Thumb.tsx'
import { usePaging } from '../../components/usePaging.ts'
import type { VariantInfo } from '../../data/useVariantCatalog.ts'

interface Props {
  eventId: string
  items: VariantInfo[]
  covers: Map<string, string>
  quantities: Record<string, number>
  /** Variants chosen for HOY in this event. */
  hoyIds: Set<string>
  loading: boolean
  onChange: (variantId: string, delta: number) => void
}

const stepper = 'inline-flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl font-semibold leading-none'

/** One row per sticker: tap the row (or the +) to add one unit. Built for one thumb on a phone. */
export function ProductGrid({ eventId, items, covers, quantities, hoyIds, loading, onChange }: Props) {
  const [search, setSearch] = useState('')
  const needle = search.trim().toLowerCase()
  const visible = items.filter(
    (item) =>
      item.published &&
      item.fulfillment !== 'unavailable' &&
      hoyIds.has(item.id) &&
      (!needle || item.label.toLowerCase().includes(needle)),
  )
  const paging = usePaging(visible, 25)

  return (
    <section aria-labelledby="grid-title" className="min-w-0 space-y-3">
      <h2 id="grid-title" className="sr-only">Stickers</h2>
      <SearchBox id="grid-search" label="Buscar sticker" placeholder="Buscar sticker" value={search} onChange={(v) => { setSearch(v); paging.setPage(0) }} />
      {!loading && hoyIds.size === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-line bg-white px-5 py-8 text-center">
          <p className="font-semibold">Este evento todavía no tiene stickers</p>
          <p className="hint mt-1">Elegí cuáles vas a vender en la pestaña HOY del evento. Después volvés y ya los tenés acá.</p>
          <Link to={`/eventos/${eventId}`} className="btn mt-4 inline-flex min-h-12 items-center px-6">Cargar stickers del evento</Link>
        </div>
      )}
      {!loading && hoyIds.size > 0 && visible.length === 0 && <p className="hint">Ningún sticker del evento coincide con la búsqueda.</p>}
      <ul className="rounded-2xl border border-line bg-white">
        {paging.paged.map((item) => {
          const qty = quantities[item.id] ?? 0
          const disabled = item.price === null
          return (
            <li key={item.id} className={`flex items-center gap-3 border-t border-line p-2 first:border-t-0 ${qty ? 'bg-crema' : ''}`}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(item.id, 1)}
                className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl text-left disabled:opacity-50"
              >
                <Thumb path={covers.get(item.productId)} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium">{item.productName}</span>
                  <span className="block truncate text-sm text-muted">{item.sizeName} · {item.materialName} · {item.finishName}</span>
                  <span className="block text-sm font-semibold">{disabled ? 'Sin precio' : `$ ${item.price?.toLocaleString('es-AR')}`}</span>
                </span>
              </button>
              {qty > 0 ? (
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" className={`${stepper} border-2 border-line bg-white`} aria-label={`Quitar uno de ${item.productName}`} onClick={() => onChange(item.id, -1)}>−</button>
                  <span className="w-8 text-center text-lg font-semibold" aria-live="polite">{qty}</span>
                  <button type="button" className={`${stepper} bg-naranja-dark text-white`} aria-label={`Sumar uno de ${item.productName}`} onClick={() => onChange(item.id, 1)}>+</button>
                </div>
              ) : (
                <button type="button" disabled={disabled} className={`${stepper} bg-naranja-dark text-white disabled:opacity-40`} aria-label={`Sumar ${item.productName}`} onClick={() => onChange(item.id, 1)}>+</button>
              )}
            </li>
          )
        })}
      </ul>
      <Pager paging={paging} label="stickers" id="grid-page-size" />
    </section>
  )
}
