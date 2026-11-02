import { useState } from 'react'
import { Pager } from '../../components/Pager.tsx'
import { SearchBox } from '../../components/SearchBox.tsx'
import { useToast } from '../../components/toast.ts'
import { usePaging } from '../../components/usePaging.ts'
import type { EventRow } from '../../data/types.ts'
import { useRows } from '../../data/useRows.ts'
import { useVariantCatalog } from '../../data/useVariantCatalog.ts'
import { supabase } from '../../lib/supabase.ts'

interface EventVariant {
  event_id: string
  variant_id: string
}

/** Variants offered in the HOY experience of this event. */
export function HoyVariants({ event }: { event: EventRow }) {
  const catalog = useVariantCatalog()
  const chosen = useRows<EventVariant>('event_variants')
  const { notify } = useToast()
  const [search, setSearch] = useState('')
  const [only, setOnly] = useState<'' | 'chosen'>('')
  const closed = event.status === 'closed'

  const selected = new Set(chosen.rows.filter((r) => r.event_id === event.id).map((r) => r.variant_id))
  const available = catalog.items.filter((item) => item.published && item.fulfillment !== 'unavailable' && item.price !== null)
  const needle = search.trim().toLowerCase()
  const shown = available.filter(
    (item) => (!needle || item.label.toLowerCase().includes(needle)) && (only !== 'chosen' || selected.has(item.id)),
  )
  const paging = usePaging(shown, 10)

  async function toggle(variantId: string, on: boolean) {
    if (!supabase) return
    const { error: failure } = on
      ? await supabase.from('event_variants').insert({ event_id: event.id, variant_id: variantId })
      : await supabase.from('event_variants').delete().eq('event_id', event.id).eq('variant_id', variantId)
    if (failure) notify(failure.message, 'error')
    chosen.reload()
  }

  return (
    <div className="space-y-4">
      <p className="hint">Elegí qué variantes se muestran en HOY durante este evento. Solo aparecen las publicadas y con precio.</p>
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox id="hoy-search" label="Buscar variante" placeholder="Buscar por diseño, tamaño o material" value={search} onChange={(v) => { setSearch(v); paging.setPage(0) }} />
        <div className="w-40">
          <label className="sr-only" htmlFor="hoy-only">Mostrar</label>
          <select id="hoy-only" className="input" value={only} onChange={(e) => { setOnly(e.target.value as '' | 'chosen'); paging.setPage(0) }}>
            <option value="">Todas</option>
            <option value="chosen">Solo elegidas</option>
          </select>
        </div>
        <span className={selected.size > 0 ? 'chip chip-ok' : 'chip chip-off'}>{selected.size} elegidas</span>
      </div>

      {catalog.loading && <p className="hint" role="status">Cargando…</p>}
      {catalog.error && <p className="error" role="alert">{catalog.error}</p>}
      {!catalog.loading && available.length === 0 && <p className="hint">Todavía no hay variantes con precio. Cargalas desde Precios y Diseños.</p>}
      {available.length > 0 && shown.length === 0 && <p className="hint">Ninguna variante coincide.</p>}
      {shown.length > 0 && (
        <ul className="rounded-xl border border-line bg-white">
          {paging.paged.map((item) => (
            <li key={item.id} className="border-t border-line first:border-t-0">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 text-sm">
                <input type="checkbox" disabled={closed} checked={selected.has(item.id)} onChange={(e) => void toggle(item.id, e.target.checked)} />
                {item.label}
              </label>
            </li>
          ))}
        </ul>
      )}
      <Pager paging={paging} label="variantes" id="hoy-page-size" />
    </div>
  )
}
