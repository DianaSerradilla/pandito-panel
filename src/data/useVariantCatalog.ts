import { useMemo } from 'react'
import type { Collection, Finish, Fulfillment, Material, PriceRow, Product, Size, Variant } from './types.ts'
import { useRows } from './useRows.ts'

export interface VariantInfo {
  id: string
  productId: string
  productCode: string
  productName: string
  collectionId: string
  sizeId: string
  sizeName: string
  materialId: string
  materialName: string
  finishId: string
  finishName: string
  label: string
  price: number | null
  fulfillment: Fulfillment
  published: boolean
}

/** Every variant with readable names and its effective price (own override, else the price list). */
export function useVariantCatalog() {
  const products = useRows<Product>('products', ['code'])
  const variants = useRows<Variant>('product_variants', ['sort_order'])
  const sizes = useRows<Size>('sizes')
  const materials = useRows<Material>('materials')
  const finishes = useRows<Finish>('finishes')
  const prices = useRows<PriceRow>('price_list')

  const collections = useRows<Collection>('collections', ['sort_order'])
  const loading = [products, variants, sizes, materials, finishes, prices].some((q) => q.loading)
  const error = [products, variants, sizes, materials, finishes, prices].find((q) => q.error)?.error ?? null

  const items = useMemo<VariantInfo[]>(() => {
    const list: VariantInfo[] = []
    for (const v of variants.rows) {
      const product = products.rows.find((p) => p.id === v.product_id)
      const size = sizes.rows.find((s) => s.id === v.size_id)
      const material = materials.rows.find((m) => m.id === v.material_id)
      const finish = finishes.rows.find((f) => f.id === v.finish_id)
      if (!product || !size || !material || !finish) continue
      const listed = prices.rows.find(
        (r) => r.active && r.material_id === v.material_id && r.finish_id === v.finish_id && r.size_id === v.size_id,
      )
      list.push({
        id: v.id,
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        collectionId: product.collection_id,
        sizeId: size.id,
        sizeName: size.name,
        materialId: material.id,
        materialName: material.name,
        finishId: finish.id,
        finishName: finish.name,
        label: `${product.code} ${product.name} · ${size.name} · ${material.name} · ${finish.name}`,
        price: v.price_override ?? listed?.price ?? null,
        fulfillment: v.fulfillment,
        // An archived design never shows up as sellable, even if its variants kept their own flag.
        published: v.published && !product.archived_at,
      })
    }
    return list.sort((a, b) => a.productCode.localeCompare(b.productCode) || a.label.localeCompare(b.label))
  }, [products.rows, variants.rows, sizes.rows, materials.rows, finishes.rows, prices.rows])

  return { items, sizes: sizes.rows, collections: collections.rows, loading, error }
}
