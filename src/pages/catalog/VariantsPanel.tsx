import { useState, type FormEvent } from 'react'
import { fulfillmentLabels, type Finish, type Material, type Product, type Size, type Variant } from '../../data/types.ts'
import { useToast } from '../../components/toast.ts'
import { formatMeasures } from '../../data/measures.ts'
import { supabase } from '../../lib/supabase.ts'
import { ProductImages } from './ProductImages.tsx'

export interface VariantStock {
  variant_id: string
  on_hand: number
  reserved: number
}

interface Props {
  product: Product
  variants: Variant[]
  stock: Map<string, VariantStock>
  priceOf: (variant: Variant) => number | null
  sizes: Size[]
  materials: Material[]
  finishes: Finish[]
  onChanged: () => void
  pickCover?: boolean
  onPickHandled?: () => void
}

const money = (value: number | null) => (value === null ? 'Sin precio' : `$ ${value.toLocaleString('es-AR')}`)
const nameOf = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? '?'

/** Details of one design: its variants (size, material, finish), price and stock, readable like the spreadsheet. */
export function VariantsPanel({ product, variants, stock, priceOf, sizes, materials, finishes, onChanged, pickCover, onPickHandled }: Props) {
  const [sizeId, setSizeId] = useState('')
  const [materialId, setMaterialId] = useState('')
  const [finishId, setFinishId] = useState('')
  // Start from the design's measures: most variants only change them a little, or not at all.
  const designWidth = product.width_mm?.toString() ?? ''
  const designHeight = product.height_mm?.toString() ?? ''
  const [width, setWidth] = useState(designWidth)
  const [height, setHeight] = useState(designHeight)
  const [adding, setAdding] = useState(false)
  const { notify } = useToast()

  async function add(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    // The SKU is left empty on purpose: the database builds it.
    const { error } = await supabase
      .from('product_variants')
      .insert({
        product_id: product.id,
        size_id: sizeId,
        material_id: materialId,
        finish_id: finishId,
        sku: '',
        width_mm: Number(width),
        height_mm: Number(height),
      })
    if (error) {
      notify(error.code === '23505' ? 'Esa combinación ya existe.' : error.message, 'error')
      return
    }
    notify('Variante agregada.', 'success')
    {
      setAdding(false)
      setSizeId('')
      setMaterialId('')
      setFinishId('')
      setWidth(designWidth)
      setHeight(designHeight)
      onChanged()
    }
  }

  async function remove(variant: Variant) {
    if (!supabase) return
    const { error } = await supabase.from('product_variants').delete().eq('id', variant.id)
    if (error) {
      if (error.code !== '23503') {
        notify(error.message, 'error')
        return
      }
      // It already has sales or movements: keep its history and take it out of circulation instead.
      const { error: archiveError } = await supabase
        .from('product_variants')
        .update({ published: false, fulfillment: 'unavailable' })
        .eq('id', variant.id)
      if (archiveError) {
        notify(archiveError.message, 'error')
        return
      }
      notify('Tiene movimientos, así que no se borra: quedó archivada (inactiva y no disponible).', 'success')
      onChanged()
      return
    }
    notify('Variante borrada.', 'success')
    onChanged()
  }

  return (
    <div className="space-y-5 border-l-4 border-azul bg-surface px-6 py-5">
      <section aria-label="Variantes" className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Variantes</h3>
          <button type="button" className="btn-quiet" aria-expanded={adding} onClick={() => setAdding((value) => !value)}>
            {adding ? 'Cancelar' : 'Agregar variante'}
          </button>
        </div>
        {adding && (
          <form onSubmit={add} aria-label="Agregar variante" className="flex flex-wrap items-end gap-3">
            {([
              ['Tamaño', sizeId, setSizeId, sizes],
              ['Material', materialId, setMaterialId, materials],
              ['Barnizado', finishId, setFinishId, finishes],
            ] as const).map(([label, value, set, list]) => (
              <div key={label} className="w-44">
                <label className="mb-1 block text-xs text-muted" htmlFor={`add-${product.id}-${label}`}>{label}</label>
                <select id={`add-${product.id}-${label}`} required className="input" value={value} onChange={(e) => set(e.target.value)}>
                  <option value="">Elegí</option>
                  {list.filter((item) => item.active).map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
            ))}
            {([
              ['Ancho (mm)', width, setWidth],
              ['Alto (mm)', height, setHeight],
            ] as const).map(([label, value, set]) => (
              <div key={label} className="w-32">
                <label className="mb-1 block text-xs text-muted" htmlFor={`add-${product.id}-${label}`}>{label}</label>
                <input
                  id={`add-${product.id}-${label}`}
                  required
                  type="number"
                  min="1"
                  step="any"
                  className="input"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                />
              </div>
            ))}
            <button type="submit" className="btn">Guardar variante</button>
          </form>
        )}
        {variants.length === 0 ? (
          <p className="hint">Este diseño todavía no tiene variantes.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table>
              <thead>
                <tr>
                  <th>Tamaño</th>
                  <th>Medidas</th>
                  <th>Material</th>
                  <th>Barnizado</th>
                  <th>Precio</th>
                  <th>Condición</th>
                  <th className="text-right">Stock</th>
                  <th className="text-right">Reservado</th>
                  <th>SKU</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => {
                  const level = stock.get(v.id)
                  const onHand = level?.on_hand ?? 0
                  return (
                    <tr key={v.id}>
                      <td className="font-medium">{nameOf(sizes, v.size_id)}</td>
                      <td className="whitespace-nowrap">{formatMeasures(v.width_mm, v.height_mm) ?? <span className="text-muted">Sin medidas</span>}</td>
                      <td>{nameOf(materials, v.material_id)}</td>
                      <td>{nameOf(finishes, v.finish_id)}</td>
                      <td className="whitespace-nowrap">{money(priceOf(v))}</td>
                      <td className="whitespace-nowrap">
                        <span className={v.fulfillment === 'unavailable' ? 'chip chip-off' : 'chip chip-ok'}>{fulfillmentLabels[v.fulfillment]}</span>
                      </td>
                      <td className={`text-right tabular-nums ${onHand <= 0 ? 'text-danger' : 'font-semibold'}`}>{onHand}</td>
                      <td className="text-right tabular-nums text-muted">{level?.reserved ?? 0}</td>
                      <td className="whitespace-nowrap text-xs text-muted">{v.sku}</td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="inline-flex size-9 items-center justify-center rounded-lg border border-line bg-white text-danger hover:bg-red-50"
                          aria-label={`Borrar variante ${v.sku}`}
                          title="Borrar variante"
                          onClick={() => void remove(v)}
                        >
                          <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.6 9h6.8L12 4M6.8 6.5v4M9.2 6.5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ProductImages product={product} onChanged={onChanged} pickCover={pickCover} onPickHandled={onPickHandled} />
    </div>
  )
}
