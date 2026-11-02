import type { Product, Variant } from './types.ts'

export type DesignState = 'incomplete' | 'ready' | 'active' | 'active-incomplete'

export interface DesignStatus {
  state: DesignState
  /** What still has to be loaded before the design can be shown on the web. */
  missing: string[]
}

/**
 * A design can only be shown on the web when everything the page needs is loaded:
 * measures, description, a cover image, a shared carousel of 3 to 5 photos and at least one
 * published variant with a price.
 */
export function designStatus(
  product: Product,
  variants: Variant[],
  hasCover: boolean,
  carouselCount: number,
  priceOf: (variant: Variant) => number | null,
): DesignStatus {
  const missing: string[] = []
  if (product.width_mm === null || product.height_mm === null) missing.push('medidas')
  if (!product.description?.trim()) missing.push('descripción')
  if (!hasCover) missing.push('portada')
  if (carouselCount < 3) missing.push('carrusel (3 a 5 fotos)')
  if (!variants.some((v) => v.published && priceOf(v) !== null)) missing.push('variante con precio')

  const complete = missing.length === 0
  const state: DesignState = product.published ? (complete ? 'active' : 'active-incomplete') : complete ? 'ready' : 'incomplete'
  return { state, missing }
}

export const designStateChip: Record<DesignState, { label: string; className: string }> = {
  incomplete: { label: 'Incompleto', className: 'chip chip-warn' },
  ready: { label: 'Listo para activar', className: 'chip chip-ok' },
  active: { label: 'Activo en la web', className: 'chip chip-ok' },
  'active-incomplete': { label: 'Activo con datos faltantes', className: 'chip chip-bad' },
}
