import type { Collection, Finish, Material, Product, Size, Variant } from '../data/types.ts'
import { readAll } from './readAll.ts'
import { supabase } from './supabase.ts'

type Cell = string | number | boolean | null | undefined
type SheetRow = Record<string, Cell>

interface SheetPayload {
  error?: string
  productos?: SheetRow[]
  colecciones?: SheetRow[]
}

export interface SyncSummary {
  collections: number
  productsCreated: number
  productsUpdated: number
  variantsCreated: number
  skipped: string[]
}

/**
 * The sheet link carries a secret token, so it is NOT an environment variable (those are baked into
 * the public JavaScript). It lives in the `settings` table, which only signed-in staff can read.
 */
async function readSheetUrl(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.from('settings').select('value').eq('key', 'sheet_sync_url').maybeSingle()
  const value: unknown = data?.value
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

const text = (value: Cell) => (value === null || value === undefined ? '' : String(value).trim())

/** The sheet may hand back 35.5 or "35,5" depending on cell format. */
function toNumber(value: Cell): number | null {
  const raw = text(value).replace(',', '.')
  if (raw === '') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

function saleStatus(value: string): string {
  const v = value.toLowerCase()
  if (v === 'sí' || v === 'si') return 'on_sale'
  if (v.includes('cliente')) return 'client_only'
  if (v.includes('regalo')) return 'gift'
  if (v.includes('exhib')) return 'internal'
  return 'test'
}

// The sheet says Termo / Celular; the panel says Grande / Chico.
const sizeNames: Record<string, string> = { termo: 'grande', celular: 'chico' }

/**
 * Pulls designs, collections and one variant per design from the admin spreadsheet.
 * Additive: it never deletes, and for designs that already exist it only refreshes the name and
 * measures, so photos, descriptions and the Activo flag set in the panel are kept.
 */
export async function syncFromSheet(): Promise<SyncSummary> {
  const client = supabase
  if (!client) throw new Error('El panel no está conectado a Supabase.')
  const sheetSyncUrl = await readSheetUrl()
  if (!sheetSyncUrl) throw new Error('Falta cargar el enlace de la planilla en Ajustes (sheet_sync_url).')

  const response = await fetch(sheetSyncUrl)
  if (!response.ok) throw new Error(`La planilla respondió ${response.status}.`)
  const payload = (await response.json()) as SheetPayload
  if (payload.error) throw new Error('La planilla rechazó la consulta: revisá el token del enlace guardado.')

  const skipped: string[] = []

  // Collections: upsert by code. Sort order and product type are left alone.
  const collectionRows = (payload.colecciones ?? [])
    .map((row) => ({
      code: text(row['Código']).toUpperCase(),
      name: text(row['Colección']),
      kind: text(row['Tipo']) || null,
      sale_status: saleStatus(text(row['¿Se vende?'])),
    }))
    .filter((row) => {
      const valid = /^[A-Z]{2}$/.test(row.code) && row.name !== ''
      if (!valid && row.code) skipped.push(`Colección ${row.code}`)
      return valid
    })
  if (collectionRows.length > 0) {
    const { error } = await client.from('collections').upsert(collectionRows, { onConflict: 'code' })
    if (error) throw new Error(`Colecciones: ${error.message}`)
  }

  const [collections, sizes, materials, finishes, products, variants] = await Promise.all([
    readAll<Collection>((a, b) => client.from('collections').select('*').range(a, b)),
    readAll<Size>((a, b) => client.from('sizes').select('*').range(a, b)),
    readAll<Material>((a, b) => client.from('materials').select('*').range(a, b)),
    readAll<Finish>((a, b) => client.from('finishes').select('*').range(a, b)),
    readAll<Product>((a, b) => client.from('products').select('*').order('code').range(a, b)),
    readAll<Variant>((a, b) => client.from('product_variants').select('*').order('id').range(a, b)),
  ])

  const collectionByCode = new Map(collections.map((c) => [c.code, c]))
  const sizeByName = new Map(sizes.map((s) => [s.name.toLowerCase(), s]))
  const materialByName = new Map(materials.map((m) => [m.name.toLowerCase(), m]))
  const finishByCode = new Map(finishes.map((f) => [f.code, f]))
  const productByCode = new Map(products.map((p) => [p.code, p]))
  const usedSlugs = new Set(products.map((p) => p.slug))
  const variantByKey = new Map(variants.map((v) => [`${v.product_id}|${v.material_id}|${v.finish_id}|${v.size_id}`, v]))
  const newKeys = new Set<string>()

  const toCreate: { code: string; slug: string; name: string; collection_id: string; width_mm: number | null; height_mm: number | null }[] = []
  let productsUpdated = 0

  // A suffix on the code (ST-01C) marks another variant of the same design: rows share the base code.
  const CODE = /^([A-Z]{2}-\d+)[A-Z]?$/
  const rows = (payload.productos ?? []).filter((row) => CODE.test(text(row['Código'])))
  const baseOf = (row: SheetRow) => text(row['Código']).match(CODE)![1]
  const groups = new Map<string, SheetRow[]>()
  for (const row of rows) groups.set(baseOf(row), [...(groups.get(baseOf(row)) ?? []), row])

  for (const [code, group] of groups) {
    // The row without suffix, when there is one, carries the design's own name and measures.
    const lead = group.find((row) => text(row['Código']) === code) ?? group[0]
    const name = text(lead['Nombre'])
    const collection = collectionByCode.get(code.slice(0, 2))
    if (!name || !collection) {
      skipped.push(`Diseño ${code}`)
      continue
    }
    const width = toNumber(lead['Ancho (mm)'])
    const height = toNumber(lead['Alto (mm)'])
    const existing = productByCode.get(code)
    if (existing) {
      const { error } = await client.from('products').update({ name, width_mm: width, height_mm: height }).eq('id', existing.id)
      if (error) throw new Error(`${code}: ${error.message}`)
      productsUpdated += 1
    } else {
      let slug = slugify(name) || slugify(code)
      if (usedSlugs.has(slug)) slug = `${slug}-${code.toLowerCase()}`
      usedSlugs.add(slug)
      toCreate.push({ code, slug, name, collection_id: collection.id, width_mm: width, height_mm: height })
    }
  }

  if (toCreate.length > 0) {
    const { data, error } = await client.from('products').insert(toCreate).select('*')
    if (error) throw new Error(`Diseños nuevos: ${error.message}`)
    for (const product of (data as Product[]) ?? []) productByCode.set(product.code, product)
  }

  // One variant per row, from its Tamaño / Material / Barniz columns, with that row's own measures.
  const newVariants: {
    product_id: string
    material_id: string
    finish_id: string
    size_id: string
    sku: string
    width_mm: number | null
    height_mm: number | null
  }[] = []
  for (const row of rows) {
    const code = baseOf(row)
    const product = productByCode.get(code)
    if (!product) continue
    const size = sizeByName.get(sizeNames[text(row['Tamaño']).toLowerCase()] ?? text(row['Tamaño']).toLowerCase())
    const material = materialByName.get(text(row['Material']).toLowerCase())
    const varnish = text(row['Barniz sectorizado']).toLowerCase()
    const finish = finishByCode.get(varnish === 'sí' || varnish === 'si' ? 'BS' : 'NONE')
    if (!size || !material || !finish) {
      skipped.push(`Variante de ${code} (tamaño, material o barniz sin equivalente)`)
      continue
    }
    const key = `${product.id}|${material.id}|${finish.id}|${size.id}`
    const width = toNumber(row['Ancho (mm)'])
    const height = toNumber(row['Alto (mm)'])
    const found = variantByKey.get(key)
    if (found) {
      // Same policy as the design: the spreadsheet keeps the measures up to date.
      if (width !== null && height !== null && (found.width_mm !== width || found.height_mm !== height)) {
        const { error } = await client.from('product_variants').update({ width_mm: width, height_mm: height }).eq('id', found.id)
        if (error) throw new Error(`Medidas de ${text(row['Código'])}: ${error.message}`)
      }
      continue
    }
    if (newKeys.has(key)) continue
    newKeys.add(key)
    // The SKU is left empty on purpose: the database builds it.
    newVariants.push({ product_id: product.id, material_id: material.id, finish_id: finish.id, size_id: size.id, sku: '', width_mm: width, height_mm: height })
  }
  if (newVariants.length > 0) {
    const { error } = await client.from('product_variants').insert(newVariants)
    if (error) throw new Error(`Variantes: ${error.message}`)
  }

  return {
    collections: collectionRows.length,
    productsCreated: toCreate.length,
    productsUpdated,
    variantsCreated: newVariants.length,
    skipped,
  }
}
