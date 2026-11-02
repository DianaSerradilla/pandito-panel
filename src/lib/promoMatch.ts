import type { Promotion } from '../data/types.ts'

/** One physical sticker in the ticket (a line with quantity 3 gives three units). */
export interface PromoUnit {
  productId: string
  sizeId: string
  materialId: string
  finishId: string
  price: number
}

export interface AppliedPack {
  promotion: Promotion
  packPrice: number
  times: number
  /** What these packs take off the list prices. */
  saved: number
}

/** A promotion that is a few units away from applying. */
export interface PromoHint {
  promotion: Promotion
  missing: number
}

export interface PromoOutcome {
  applied: AppliedPack[]
  /** Never negative, never more than the units cost. */
  discount: number
  hints: PromoHint[]
}

export const isCurrent = (promotion: Promotion, now = Date.now()) =>
  promotion.active &&
  (!promotion.starts_at || Date.parse(promotion.starts_at) <= now) &&
  (!promotion.ends_at || Date.parse(promotion.ends_at) >= now)

type Slot = { unit: PromoUnit; index: number }
type Pack = { chosen: Slot[]; list: number; packPrice: number }
type Designs = (promotionId: string) => Set<string>

const matches = (promotion: Promotion, unit: PromoUnit) =>
  (!promotion.size_id || promotion.size_id === unit.sizeId) &&
  (!promotion.material_id || promotion.material_id === unit.materialId) &&
  (!promotion.finish_id || promotion.finish_id === unit.finishId)

const byPrice = (a: Slot, b: Slot) => b.unit.price - a.unit.price || a.index - b.index

/**
 * One pack of a promotion out of the free units (highest price first), or null when it cannot be
 * formed or would not save anything. This is the same rule the public web uses
 * (pandito/src/data/promotions.ts), so both show the same total for the same order:
 *
 * - A basic promotion takes `quantity` units that match its filter, any design.
 * - A special promotion takes `quantity` units of its designs. When `quantity` equals the number of
 *   designs, the buyer needs one of each, together.
 * - A percentage is applied to the units of the pack; a fixed price replaces their price.
 */
function formPack(promotion: Promotion, free: Slot[], designsOf: Designs): Pack | null {
  let chosen: Slot[]
  if (promotion.kind === 'basic') {
    chosen = free.filter((slot) => matches(promotion, slot.unit)).slice(0, promotion.quantity)
  } else {
    const designs = designsOf(promotion.id)
    const inGroup = free.filter((slot) => designs.has(slot.unit.productId))
    if (promotion.quantity === designs.size) {
      chosen = []
      for (const id of designs) {
        const slot = inGroup.find((entry) => entry.unit.productId === id)
        if (slot) chosen.push(slot)
      }
    } else {
      chosen = inGroup.slice(0, promotion.quantity)
    }
  }
  if (chosen.length !== promotion.quantity) return null
  const list = chosen.reduce((sum, slot) => sum + slot.unit.price, 0)
  const packPrice = promotion.price ?? Math.round((list * (100 - (promotion.discount_percent ?? 0))) / 100)
  if (!(packPrice >= 0) || packPrice >= list) return null
  return { chosen, list, packPrice }
}

function missingFor(promotion: Promotion, free: Slot[], designsOf: Designs): number {
  if (promotion.kind === 'basic') {
    const have = free.filter((slot) => matches(promotion, slot.unit)).length
    return have > 0 && have < promotion.quantity ? promotion.quantity - have : 0
  }
  const designs = designsOf(promotion.id)
  const inGroup = free.filter((slot) => designs.has(slot.unit.productId))
  const have = promotion.quantity === designs.size ? new Set(inGroup.map((slot) => slot.unit.productId)).size : inGroup.length
  return have > 0 && have < promotion.quantity ? promotion.quantity - have : 0
}

const MAX_HINT = 6
const HINTS = 2

/**
 * The units of the ticket priced with the promotions. Each unit goes in at most one pack. Packs are
 * built greedily, the biggest saving first, and the same promotion can apply many times.
 */
export function applyPromotions(promotions: Promotion[], designsOf: Designs, units: PromoUnit[]): PromoOutcome {
  const current = promotions.filter((p) => isCurrent(p))
  let free: Slot[] = units.map((unit, index) => ({ unit, index })).sort(byPrice)
  const applied = new Map<string, AppliedPack>()
  let discount = 0

  for (;;) {
    let best: { promotion: Promotion; pack: Pack } | null = null
    for (const promotion of current) {
      const pack = formPack(promotion, free, designsOf)
      if (pack && (!best || pack.list - pack.packPrice > best.pack.list - best.pack.packPrice)) best = { promotion, pack }
    }
    if (!best) break
    const taken = new Set(best.pack.chosen)
    free = free.filter((slot) => !taken.has(slot))
    const saved = best.pack.list - best.pack.packPrice
    discount += saved
    const id = `${best.promotion.id}|${best.pack.packPrice}`
    const previous = applied.get(id)
    applied.set(id, {
      promotion: best.promotion,
      packPrice: best.pack.packPrice,
      times: (previous?.times ?? 0) + 1,
      saved: (previous?.saved ?? 0) + saved,
    })
  }

  const hints: PromoHint[] = []
  for (const promotion of current) {
    const missing = missingFor(promotion, free, designsOf)
    if (missing === 0 || missing > MAX_HINT) continue
    const designs = promotion.kind === 'special' ? designsOf(promotion.id) : null
    const counting = free.filter((slot) => (designs ? designs.has(slot.unit.productId) : matches(promotion, slot.unit)))
    const cheapest = counting[counting.length - 1]
    const present = new Set(counting.map((slot) => slot.unit.productId))
    const wanted =
      designs && promotion.quantity === designs.size
        ? [...designs].filter((id) => !present.has(id))
        : new Array<string>(missing).fill(cheapest.unit.productId)
    const extra: Slot[] = wanted.map((productId, offset) => ({ unit: { ...cheapest.unit, productId }, index: units.length + offset }))
    if (formPack(promotion, [...free, ...extra].sort(byPrice), designsOf)) hints.push({ promotion, missing })
  }
  hints.sort((a, b) => a.missing - b.missing)

  return { applied: [...applied.values()], discount, hints: hints.slice(0, HINTS) }
}

/** "10 % de descuento" or "$ 5.000 el pack". */
export function describeDiscount(promotion: Promotion) {
  return promotion.discount_percent !== null
    ? `${promotion.discount_percent.toLocaleString('es-AR')} % de descuento`
    : `$ ${(promotion.price ?? 0).toLocaleString('es-AR')} el pack`
}
