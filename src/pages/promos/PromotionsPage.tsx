import { useState } from 'react'
import type { Finish, Material, PriceRow, Product, Promotion, Size, Variant } from '../../data/types.ts'
import { useRows } from '../../data/useRows.ts'
import { PromotionList } from './PromotionList.tsx'
import type { PromoKind, PromoOptions } from './PromotionModal.tsx'

export interface PromoProblem {
  text: string
  /** A blocking problem means the promo cannot be on. */
  blocking: boolean
}

interface PromotionProduct {
  promotion_id: string
  product_id: string
}

const tabClass = (selected: boolean) =>
  `-mb-px border-b-2 px-4 py-2.5 text-sm font-medium ${
    selected ? 'border-naranja-dark text-tinta' : 'border-transparent text-muted hover:text-tinta'
  }`

const tabs: { kind: PromoKind; label: string; text: string }[] = [
  {
    kind: 'basic',
    label: 'Promos básicas',
    text: 'Una cantidad de stickers que cumplen un filtro (tamaño, material, acabado) con un porcentaje de descuento o un precio final. Ej: 3 stickers Chico con 10 %.',
  },
  {
    kind: 'special',
    label: 'Promos especiales',
    text: 'Un grupo de diseños elegidos a mano con un porcentaje de descuento o un precio final. Si la cantidad es igual al grupo se llevan todos juntos; si es menor, el comprador elige.',
  },
]

/** Two sections: basic promotions (by filter) and special ones (by hand-picked designs). */
export function PromotionsPage() {
  const promotions = useRows<Promotion>('promotions', ['sort_order', 'quantity'])
  const links = useRows<PromotionProduct>('promotion_products')
  const sizes = useRows<Size>('sizes', ['sort_order'])
  const materials = useRows<Material>('materials', ['sort_order'])
  const finishes = useRows<Finish>('finishes', ['sort_order'])
  const products = useRows<Product>('products', ['code'])
  const variants = useRows<Variant>('product_variants')
  const prices = useRows<PriceRow>('price_list')
  const [now] = useState(() => Date.now())
  const [tab, setTab] = useState<PromoKind>('basic')

  const options: PromoOptions = {
    sizes: sizes.rows.filter((s) => s.active),
    materials: materials.rows.filter((m) => m.active),
    finishes: finishes.rows.filter((f) => f.active),
    products: products.rows,
  }
  const productsOf = new Map<string, string[]>()
  for (const link of links.rows) productsOf.set(link.promotion_id, [...(productsOf.get(link.promotion_id) ?? []), link.product_id])
  const live = new Set(products.rows.filter((p) => p.published).map((p) => p.id))
  const priced = (v: Variant) =>
    v.price_override !== null ||
    prices.rows.some((r) => r.active && r.material_id === v.material_id && r.finish_id === v.finish_id && r.size_id === v.size_id)
  const problems = new Map<string, PromoProblem>()
  if (!products.loading && !variants.loading && !prices.loading && !links.loading) {
    for (const promo of promotions.rows) {
      if (promo.kind === 'special') {
        const have = (productsOf.get(promo.id) ?? []).filter((id) => live.has(id)).length
        if (have < promo.quantity) problems.set(promo.id, { text: `Tiene ${have} de ${promo.quantity} diseños activos`, blocking: true })
      } else if (
        !variants.rows.some(
          (v) =>
            v.published && live.has(v.product_id) && priced(v) &&
            (!promo.size_id || v.size_id === promo.size_id) &&
            (!promo.material_id || v.material_id === promo.material_id) &&
            (!promo.finish_id || v.finish_id === promo.finish_id),
        )
      ) {
        problems.set(promo.id, { text: 'Ningún sticker activo cumple el filtro', blocking: true })
      }
      if (!problems.has(promo.id) && promo.ends_at && new Date(promo.ends_at).getTime() < now) {
        problems.set(promo.id, { text: 'Vencida', blocking: false })
      }
    }
  }
  const reload = () => {
    promotions.reload()
    links.reload()
  }
  const current = tabs.find((t) => t.kind === tab) ?? tabs[0]

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Promociones</h1>

      <div role="tablist" aria-label="Tipos de promo" className="flex gap-2 border-b border-line">
        {tabs.map((t) => (
          <button key={t.kind} type="button" role="tab" id={`tab-${t.kind}`} aria-selected={tab === t.kind} aria-controls="panel-promos" className={tabClass(tab === t.kind)} onClick={() => setTab(t.kind)}>
            {t.label}
          </button>
        ))}
      </div>

      <section role="tabpanel" id="panel-promos" aria-labelledby={`tab-${tab}`} className="space-y-5">
        <p className="hint max-w-3xl">{current.text}</p>
        {promotions.error && <p className="error" role="alert">{promotions.error}</p>}
        {links.error && <p className="error" role="alert">{links.error}</p>}
        <PromotionList kind={tab} promotions={promotions.rows} productsOf={productsOf} problems={problems} options={options} onChanged={reload} />
      </section>
    </div>
  )
}
