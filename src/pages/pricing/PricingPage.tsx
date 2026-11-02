import { useState } from 'react'
import type { Finish, Material, Size } from '../../data/types.ts'
import { useRows } from '../../data/useRows.ts'
import { LookupSection } from './LookupSection.tsx'
import { PriceMatrix } from './PriceMatrix.tsx'

type Tab = 'base' | 'prices'
type Catalog = 'sizes' | 'materials' | 'finishes'

const tabClass = (selected: boolean) =>
  `-mb-px border-b-2 px-4 py-2.5 text-sm font-medium ${
    selected ? 'border-naranja-dark text-tinta' : 'border-transparent text-muted hover:text-tinta'
  }`

const pillClass = (selected: boolean) =>
  `inline-flex min-h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium ${
    selected ? 'border-tinta bg-tinta text-crema' : 'border-line bg-white text-tinta hover:bg-crema'
  }`

/** Two sections: the base lists (one at a time), then the price of every variant they allow. */
export function PricingPage() {
  const sizes = useRows<Size>('sizes', ['sort_order'])
  const materials = useRows<Material>('materials', ['sort_order'])
  const finishes = useRows<Finish>('finishes', ['sort_order'])
  const [tab, setTab] = useState<Tab>('base')
  const [catalog, setCatalog] = useState<Catalog>('sizes')
  const reloadAll = () => {
    sizes.reload()
    materials.reload()
    finishes.reload()
  }
  const count = (rows: { active: boolean }[]) => rows.filter((r) => r.active).length

  const catalogs = [
    { id: 'sizes', label: 'Tamaños', rows: sizes.rows },
    { id: 'materials', label: 'Materiales', rows: materials.rows },
    { id: 'finishes', label: 'Acabados', rows: finishes.rows },
  ] as const

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Precios</h1>

      <div role="tablist" aria-label="Secciones de precios" className="flex gap-2 border-b border-line">
        <button type="button" role="tab" id="tab-base" aria-selected={tab === 'base'} aria-controls="panel-base" className={tabClass(tab === 'base')} onClick={() => setTab('base')}>
          Datos base
        </button>
        <button type="button" role="tab" id="tab-prices" aria-selected={tab === 'prices'} aria-controls="panel-prices" className={tabClass(tab === 'prices')} onClick={() => setTab('prices')}>
          Variantes y precios
        </button>
      </div>

      {tab === 'base' && (
        <section role="tabpanel" id="panel-base" aria-labelledby="tab-base" className="max-w-3xl space-y-5">
          <p className="hint">
            Cargá lo que vendés. La medida en milímetros no va acá: es de cada sticker y se carga en Diseños.
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Catálogo">
            {catalogs.map((c) => (
              <button key={c.id} type="button" aria-pressed={catalog === c.id} className={pillClass(catalog === c.id)} onClick={() => setCatalog(c.id)}>
                {c.label}
                <span className={catalog === c.id ? 'text-crema/80' : 'text-muted'}>{count(c.rows)}</span>
              </button>
            ))}
          </div>
          {catalog === 'sizes' && <LookupSection table="sizes" title="Tamaños" noun="tamaño" codeHint="Arma el SKU. Ej: S, L." onChanged={reloadAll} />}
          {catalog === 'materials' && <LookupSection table="materials" title="Materiales" noun="material" codeHint="Arma el SKU. Ej: UV, DTF." onChanged={reloadAll} />}
          {catalog === 'finishes' && <LookupSection table="finishes" title="Acabados" noun="acabado" codeHint="Arma el SKU. Ej: NONE, BS." onChanged={reloadAll} />}
        </section>
      )}

      {tab === 'prices' && (
        <section role="tabpanel" id="panel-prices" aria-labelledby="tab-prices" className="space-y-5">
          <p className="hint max-w-3xl">
            Una variante es un tamaño con un material y un acabado, con su precio. Creala con “Agregar variante”; los cambios de precio y estado se guardan juntos. Una variante sin crear aquí no tiene precio en la web.
          </p>
          <PriceMatrix
            sizes={sizes.rows}
            materials={materials.rows}
            finishes={finishes.rows}
            loading={sizes.loading || materials.loading || finishes.loading}
          />
        </section>
      )}
    </div>
  )
}
