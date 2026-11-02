import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import {
  fulfillmentLabels,
  type Finish,
  type Fulfillment,
  type Material,
  type PriceRow,
  type Product,
  type Size,
  type Variant,
} from '../../data/types.ts'
import { TopicPicker } from '../../components/TopicPicker.tsx'
import { useRows } from '../../data/useRows.ts'
import { useToast } from '../../components/toast.ts'
import { supabase } from '../../lib/supabase.ts'
import { ProductImages } from './ProductImages.tsx'

const toNumber = (value: string) => (value.trim() === '' ? null : Number(value.replace(',', '.')))
const money = (value: number | null) => (value === null ? 'Sin precio' : `$ ${value.toLocaleString('es-AR')}`)

function PriceOverride({ variant, onSaved }: { variant: Variant; onSaved: (message: string | null) => void }) {
  const [value, setValue] = useState(variant.price_override?.toString() ?? '')

  async function save() {
    if (!supabase) return
    const parsed = toNumber(value)
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      onSaved('Ingresá un precio válido')
      return
    }
    const { error } = await supabase.from('product_variants').update({ price_override: parsed }).eq('id', variant.id)
    onSaved(error ? error.message : null)
  }

  return (
    <div className="flex items-end gap-2">
      <div className="w-32">
        <label className="label" htmlFor={`po-${variant.id}`}>Precio propio</label>
        <input id={`po-${variant.id}`} inputMode="decimal" className="input" placeholder="Usa la lista" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <button type="button" className="btn-quiet" onClick={() => void save()}>Guardar</button>
    </div>
  )
}

function ProductForm({ product, canPublish, onSaved }: { product: Product; canPublish: boolean; onSaved: () => void }) {
  const [name, setName] = useState(product.name)
  const [description, setDescription] = useState(product.description ?? '')
  const [usage, setUsage] = useState(product.usage_suggestions ?? '')
  const [width, setWidth] = useState(product.width_mm?.toString() ?? '')
  const [height, setHeight] = useState(product.height_mm?.toString() ?? '')
  const [published, setPublished] = useState(product.published)
  const [featured, setFeatured] = useState(product.featured)
  const [featuredOrder, setFeaturedOrder] = useState(product.featured_order?.toString() ?? '')
  const { notify } = useToast()

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    if (published && !canPublish) {
      notify('Para publicar, agregá al menos una variante publicada y con precio.', 'error')
      return
    }
    const order = toNumber(featuredOrder)
    if (order !== null && (!Number.isInteger(order) || order < 1)) {
      notify('El orden en el Home tiene que ser un entero desde 1.', 'error')
      return
    }
    const { error } = await supabase
      .from('products')
      .update({
        name: name.trim(),
        description: description.trim() || null,
        usage_suggestions: usage.trim() || null,
        width_mm: toNumber(width),
        height_mm: toNumber(height),
        published,
        featured,
        featured_order: featured ? order : null,
      })
      .eq('id', product.id)
    if (error) {
      notify(error.message, 'error')
      return
    }
    notify('Diseño guardado.', 'success')
    onSaved()
  }

  return (
    <form onSubmit={save} className="card space-y-4">
      <div>
        <label htmlFor="p-name" className="label">Nombre comercial</label>
        <input id="p-name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label htmlFor="p-desc" className="label">Descripción</label>
        <textarea id="p-desc" rows={3} className="input py-2" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label htmlFor="p-usage" className="label">Usos sugeridos</label>
        <textarea id="p-usage" rows={2} className="input py-2" value={usage} onChange={(e) => setUsage(e.target.value)} />
      </div>
      <div className="flex gap-3">
        <div className="w-28">
          <label htmlFor="p-w" className="label">Ancho mm</label>
          <input id="p-w" inputMode="decimal" className="input" value={width} onChange={(e) => setWidth(e.target.value)} />
        </div>
        <div className="w-28">
          <label htmlFor="p-h" className="label">Alto mm</label>
          <input id="p-h" inputMode="decimal" className="input" value={height} onChange={(e) => setHeight(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Publicado en la web
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          Destacado en el Home
        </label>
        {featured && (
          <div className="w-32">
            <label htmlFor="p-forder" className="label">Orden en el Home</label>
            <input id="p-forder" type="number" min={1} className="input" value={featuredOrder} onChange={(e) => setFeaturedOrder(e.target.value)} />
          </div>
        )}
      </div>
      <TopicPicker table="product_topics" ownerColumn="product_id" ownerId={product.id} />
      <div className="flex items-center gap-3">
        <button type="submit" className="btn">Guardar diseño</button>
      </div>
    </form>
  )
}

export function ProductPage() {
  const { productId } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<Variant[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((v) => v + 1), [])

  const sizes = useRows<Size>('sizes', ['sort_order'])
  const materials = useRows<Material>('materials', ['sort_order'])
  const finishes = useRows<Finish>('finishes', ['sort_order'])
  const prices = useRows<PriceRow>('price_list')

  const [materialId, setMaterialId] = useState('')
  const [finishId, setFinishId] = useState('')
  const [sizeId, setSizeId] = useState('')
  const { notify } = useToast()

  useEffect(() => {
    if (!supabase || !productId) return
    let cancelled = false
    void Promise.all([
      supabase.from('products').select('*').eq('id', productId).maybeSingle(),
      supabase.from('product_variants').select('*').eq('product_id', productId).order('sort_order').order('sku'),
    ]).then(([p, v]) => {
      if (cancelled) return
      setProduct((p.data as Product | null) ?? null)
      setVariants((v.data as Variant[] | null) ?? [])
      setLoadError(p.error?.message ?? v.error?.message ?? (p.data ? null : 'No encontramos este diseño.'))
    })
    return () => {
      cancelled = true
    }
  }, [productId, tick])

  const name = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? '?'
  const listPrice = (v: Variant) =>
    prices.rows.find((r) => r.active && r.material_id === v.material_id && r.finish_id === v.finish_id && r.size_id === v.size_id)?.price ?? null

  async function addVariant(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !productId) return
    // The SKU is left empty on purpose: the database builds it.
    const { error } = await supabase
      .from('product_variants')
      .insert({ product_id: productId, material_id: materialId, finish_id: finishId, size_id: sizeId, sku: '' })
    if (error) {
      notify(error.code === '23505' ? 'Esa combinación ya existe.' : error.message, 'error')
      return
    }
    notify('Variante agregada.', 'success')
    reload()
  }

  /** The database turns a design inactive when it loses something the web needs: say so right away. */
  async function checkStillActive() {
    if (!supabase || !product?.published) return
    const { data } = await supabase.from('products').select('published').eq('id', product.id).single()
    if (!data || data.published) return
    const { data: missing } = await supabase.rpc('design_missing', { p_id: product.id })
    notify(`${product.code} quedó inactivo en la web: falta ${((missing as string[] | null) ?? []).join(', ')}.`, 'error')
    reload()
  }

  async function updateVariant(id: string, changes: Partial<Variant>) {
    if (!supabase) return
    const { error } = await supabase.from('product_variants').update(changes).eq('id', id)
    if (error) notify(error.message, 'error')
    reload()
    void checkStillActive()
  }

  if (loadError) return <p className="error" role="alert">{loadError}</p>
  if (!product) return <p className="hint" role="status">Cargando…</p>

  return (
    <div className="space-y-6">
      <div>
        <Link to="/catalogo" className="text-sm underline underline-offset-2">← Catálogo</Link>
        <h1 className="mt-1 text-2xl font-semibold">
          <span className="mr-2 text-muted">{product.code}</span>
          {product.name}
        </h1>
      </div>

      <ProductForm key={product.id + tick} product={product} canPublish={variants.some((v) => v.published && (v.price_override ?? listPrice(v)) !== null)} onSaved={reload} />

      <ProductImages product={product} onChanged={() => void checkStillActive()} />

      <section className="card space-y-3" aria-labelledby="variants-title">
        <h2 id="variants-title" className="text-lg font-semibold">Variantes</h2>
        <p className="hint">
          Cada variante es una combinación válida de material, acabado y tamaño. Hoy todas quedan “A pedido”.
        </p>
        {variants.length === 0 && <p className="hint">Este diseño todavía no tiene variantes.</p>}
        <ul>
          {variants.map((v) => (
            <li key={v.id} className="flex flex-wrap items-end gap-3 border-t border-line py-3 first:border-t-0">
              <div className="min-w-48 flex-1">
                <p className="text-sm font-medium">
                  {name(materials.rows, v.material_id)} · {name(finishes.rows, v.finish_id)} · {name(sizes.rows, v.size_id)}
                </p>
                <p className="hint">
                  {v.sku} · Precio {money(v.price_override ?? listPrice(v))}
                  {v.price_override !== null && ' (propio)'}
                </p>
              </div>
              <div className="w-40">
                <label className="label" htmlFor={`f-${v.id}`}>Condición</label>
                <select id={`f-${v.id}`} className="input" value={v.fulfillment} onChange={(e) => void updateVariant(v.id, { fulfillment: e.target.value as Fulfillment })}>
                  {(Object.keys(fulfillmentLabels) as Fulfillment[]).map((key) => (
                    <option key={key} value={key}>{fulfillmentLabels[key]}</option>
                  ))}
                </select>
              </div>
              <PriceOverride key={v.id + String(v.price_override)} variant={v} onSaved={(message) => { if (message) notify(message, 'error'); else notify('Precio guardado.', 'success'); reload() }} />
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={v.published} onChange={(e) => void updateVariant(v.id, { published: e.target.checked })} />
                Publicada
              </label>
            </li>
          ))}
        </ul>

        <form onSubmit={addVariant} className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
          {([
            ['Material', materialId, setMaterialId, materials.rows],
            ['Acabado', finishId, setFinishId, finishes.rows],
            ['Tamaño', sizeId, setSizeId, sizes.rows],
          ] as const).map(([label, value, set, list]) => (
            <div key={label} className="w-44">
              <label className="label" htmlFor={`new-${label}`}>{label}</label>
              <select id={`new-${label}`} required className="input" value={value} onChange={(e) => set(e.target.value)}>
                <option value="">Elegí</option>
                {list.filter((item) => item.active).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
          ))}
          <button type="submit" className="btn">Agregar variante</button>
        </form>
      </section>
    </div>
  )
}
