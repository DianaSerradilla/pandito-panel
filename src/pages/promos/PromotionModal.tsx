import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal.tsx'
import { SearchBox } from '../../components/SearchBox.tsx'
import { useToast } from '../../components/toast.ts'
import type { Finish, Material, Product, Promotion, Size } from '../../data/types.ts'
import { toIso, toLocalInput } from '../../lib/datetime.ts'
import { supabase } from '../../lib/supabase.ts'

export type PromoKind = 'basic' | 'special'

export interface PromoOptions {
  sizes: Size[]
  materials: Material[]
  finishes: Finish[]
  products: Product[]
}

interface Props {
  open: boolean
  kind: PromoKind
  promotion: Promotion | null
  /** Designs already in the promotion (special promotions only). */
  selectedProducts: string[]
  options: PromoOptions
  nextOrder: number
  onClose: () => void
  onSaved: () => void
}

type Mode = 'percent' | 'price'

function PromotionForm({ kind, promotion, selectedProducts, options, nextOrder, onClose, onSaved }: Omit<Props, 'open'>) {
  const { notify } = useToast()
  const [name, setName] = useState(promotion?.name ?? '')
  const [quantity, setQuantity] = useState(promotion ? String(promotion.quantity) : '')
  const [sizeId, setSizeId] = useState(promotion?.size_id ?? '')
  const [materialId, setMaterialId] = useState(promotion?.material_id ?? '')
  const [finishId, setFinishId] = useState(promotion?.finish_id ?? '')
  const [mode, setMode] = useState<Mode>(promotion && promotion.price !== null ? 'price' : 'percent')
  const [amount, setAmount] = useState(promotion ? String(promotion.price ?? promotion.discount_percent ?? '') : '')
  const [startsAt, setStartsAt] = useState(toLocalInput(promotion?.starts_at ?? null))
  const [endsAt, setEndsAt] = useState(toLocalInput(promotion?.ends_at ?? null))
  const [active, setActive] = useState(promotion?.active ?? false)
  const [picked, setPicked] = useState(new Set(selectedProducts))
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const needle = search.trim().toLowerCase()
  const listed = options.products.filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.code.toLowerCase().includes(needle))
  const qty = Number(quantity)
  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const value = Number(amount.replace(',', '.'))
    if (!Number.isInteger(qty) || qty < 1) return notify('La cantidad tiene que ser un entero desde 1.', 'error')
    if (!Number.isFinite(value) || value < 0 || (mode === 'percent' && (value <= 0 || value > 100))) {
      return notify(mode === 'percent' ? 'El descuento tiene que estar entre 1 y 100 %.' : 'Ingresá un precio válido.', 'error')
    }
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      return notify('La fecha de fin tiene que ser posterior a la de inicio.', 'error')
    }
    if (kind === 'special' && picked.size < qty) {
      return notify(`Elegí al menos ${qty} ${qty === 1 ? 'diseño' : 'diseños'} para el grupo.`, 'error')
    }

    const row = {
      kind,
      name: name.trim(),
      size_id: sizeId || null,
      material_id: materialId || null,
      finish_id: finishId || null,
      quantity: qty,
      price: mode === 'price' ? value : null,
      discount_percent: mode === 'percent' ? value : null,
      starts_at: toIso(startsAt),
      ends_at: toIso(endsAt),
      active,
    }
    setSaving(true)
    let id = promotion?.id
    if (id) {
      const { error } = await supabase.from('promotions').update(row).eq('id', id)
      if (error) {
        setSaving(false)
        return notify(error.message, 'error')
      }
    } else {
      const { data, error } = await supabase.from('promotions').insert({ ...row, sort_order: nextOrder }).select('id').single()
      if (error || !data) {
        setSaving(false)
        return notify(error?.message ?? 'No se pudo crear la promo.', 'error')
      }
      id = data.id as string
    }
    if (kind === 'special') {
      const cleared = await supabase.from('promotion_products').delete().eq('promotion_id', id)
      const added = cleared.error
        ? cleared
        : await supabase.from('promotion_products').insert([...picked].map((product_id) => ({ promotion_id: id, product_id })))
      if (added.error) {
        setSaving(false)
        onSaved()
        return notify(`La promo se guardó, pero no sus diseños: ${added.error.message}`, 'error')
      }
    }
    setSaving(false)
    notify(promotion ? 'Promo guardada.' : 'Promo creada.', 'success')
    onSaved()
    onClose()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div>
          <label className="label" htmlFor="promo-name">Nombre</label>
          <input id="promo-name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="promo-qty">Cantidad</label>
          <input id="promo-qty" type="number" min={1} required className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {([
          ['Tamaño', sizeId, setSizeId, options.sizes],
          ['Material', materialId, setMaterialId, options.materials],
          ['Acabado', finishId, setFinishId, options.finishes],
        ] as const).map(([label, value, set, list]) => (
          <div key={label}>
            <label className="label" htmlFor={`promo-${label}`}>{label}</label>
            <select id={`promo-${label}`} className="input" value={value} onChange={(e) => set(e.target.value)}>
              <option value="">Cualquiera</option>
              {list.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
        ))}
      </div>

      {kind === 'special' && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="label !mb-0">Diseños del grupo</span>
            <span className="chip chip-ok">{picked.size} elegidos</span>
          </div>
          <p className="hint">
            {qty >= 1 && picked.size >= qty
              ? picked.size === qty
                ? `El comprador lleva los ${qty} juntos.`
                : `El comprador elige ${qty} de los ${picked.size} del grupo.`
              : 'Elegí los diseños que entran en la promo.'}
          </p>
          <SearchBox id="promo-product-search" label="Buscar diseño" placeholder="Buscar por nombre o código" value={search} onChange={setSearch} />
          <ul className="max-h-48 overflow-y-auto overscroll-contain rounded-xl border border-line bg-white">
            {listed.length === 0 && <li className="hint px-3 py-2">Ningún diseño coincide.</li>}
            {listed.map((p) => (
              <li key={p.id} className="border-t border-line first:border-t-0">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 text-sm">
                  <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} />
                  <span className="text-muted">{p.code}</span>
                  <span>{p.name}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" className="btn-quiet min-h-9 px-3" onClick={() => setPicked(new Set([...picked, ...listed.map((p) => p.id)]))}>Elegir los que se ven</button>
            <button type="button" className="btn-quiet min-h-9 px-3" onClick={() => setPicked(new Set())}>Quitar todos</button>
          </div>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="label">Descuento</legend>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="promo-mode" checked={mode === 'percent'} onChange={() => setMode('percent')} />
            Porcentaje
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="promo-mode" checked={mode === 'price'} onChange={() => setMode('price')} />
            Precio final del pack
          </label>
          <div className="relative w-36">
            <label className="sr-only" htmlFor="promo-amount">{mode === 'percent' ? 'Porcentaje de descuento' : 'Precio final del pack'}</label>
            <input id="promo-amount" required inputMode="decimal" className="input pr-8 text-right tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{mode === 'percent' ? '%' : '$'}</span>
          </div>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="promo-from">Desde (opcional)</label>
          <input id="promo-from" type="datetime-local" className="input" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="promo-to">Hasta (opcional)</label>
          <input id="promo-to" type="datetime-local" className="input" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
      </div>

      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Activa
      </label>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="btn-quiet" disabled={saving} onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn" disabled={saving}>{saving ? 'Guardando…' : promotion ? 'Guardar promo' : 'Crear promo'}</button>
      </div>
    </form>
  )
}

/** Create or edit one promotion. The form is mounted only while open, so it always starts from the promotion given. */
export function PromotionModal({ open, kind, promotion, ...rest }: Props) {
  const title = `${promotion ? 'Editar' : 'Agregar'} promo ${kind === 'basic' ? 'básica' : 'especial'}`
  return (
    <Modal open={open} title={title} onClose={rest.onClose} wide>
      <PromotionForm kind={kind} promotion={promotion} {...rest} />
    </Modal>
  )
}
