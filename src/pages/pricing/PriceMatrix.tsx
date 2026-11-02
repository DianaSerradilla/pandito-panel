import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal.tsx'
import { Pager } from '../../components/Pager.tsx'
import { SearchBox } from '../../components/SearchBox.tsx'
import { useToast } from '../../components/toast.ts'
import { usePaging } from '../../components/usePaging.ts'
import type { Finish, Material, PriceRow, Size } from '../../data/types.ts'
import { useRows } from '../../data/useRows.ts'
import { supabase } from '../../lib/supabase.ts'

interface Props {
  sizes: Size[]
  materials: Material[]
  finishes: Finish[]
  loading: boolean
}

const toNumber = (value: string) => (value.trim() === '' ? null : Number(value.replace(',', '.')))
const nameOf = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? '?'

/**
 * The variants (size + material + finish) with their price, as a table. Variants are created one by one
 * with "Agregar variante", and only once the three base lists have something active.
 * Edited prices and states are saved together.
 */
export function PriceMatrix({ sizes, materials, finishes, loading }: Props) {
  const prices = useRows<PriceRow>('price_list')
  const { notify } = useToast()
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [activeDrafts, setActiveDrafts] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [sizeFilter, setSizeFilter] = useState('')
  const [materialFilter, setMaterialFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newSize, setNewSize] = useState('')
  const [newMaterial, setNewMaterial] = useState('')
  const [newFinish, setNewFinish] = useState('')
  const [newPrice, setNewPrice] = useState('')

  const activeSizes = sizes.filter((s) => s.active)
  const activeMaterials = materials.filter((m) => m.active)
  const activeFinishes = finishes.filter((f) => f.active)

  const priceOf = (row: PriceRow) => priceDrafts[row.id] ?? row.price.toString()
  const activeOf = (row: PriceRow) => activeDrafts[row.id] ?? row.active
  const isDirty = (row: PriceRow) =>
    (priceDrafts[row.id] !== undefined && priceDrafts[row.id] !== row.price.toString()) ||
    (activeDrafts[row.id] !== undefined && activeDrafts[row.id] !== row.active)

  const term = search.trim().toLowerCase()
  const ordered = [...prices.rows].sort(
    (a, b) =>
      nameOf(sizes, a.size_id).localeCompare(nameOf(sizes, b.size_id)) ||
      nameOf(materials, a.material_id).localeCompare(nameOf(materials, b.material_id)) ||
      nameOf(finishes, a.finish_id).localeCompare(nameOf(finishes, b.finish_id)),
  )
  const visible = ordered.filter(
    (row) =>
      (!sizeFilter || row.size_id === sizeFilter) &&
      (!materialFilter || row.material_id === materialFilter) &&
      (!term ||
        `${nameOf(sizes, row.size_id)} ${nameOf(materials, row.material_id)} ${nameOf(finishes, row.finish_id)}`
          .toLowerCase()
          .includes(term)),
  )
  const paging = usePaging(visible)
  const dirtyRows = prices.rows.filter(isDirty)

  const missing = [
    activeSizes.length === 0 && 'un tamaño',
    activeMaterials.length === 0 && 'un material',
    activeFinishes.length === 0 && 'un acabado',
  ].filter((item): item is string => Boolean(item))

  if (!loading && missing.length > 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-white px-6 py-8 text-center">
        <p className="font-medium">Todavía no se pueden crear variantes</p>
        <p className="hint mt-1">Antes cargá y activá al menos {missing.join(', ')} en Datos base.</p>
      </div>
    )
  }

  async function saveAll() {
    if (!supabase) return
    const changes = []
    for (const row of dirtyRows) {
      const value = toNumber(priceOf(row))
      if (value === null || Number.isNaN(value) || value < 0) {
        notify(`Revisá el precio de ${nameOf(sizes, row.size_id)} · ${nameOf(materials, row.material_id)} · ${nameOf(finishes, row.finish_id)}: tiene que ser un número.`, 'error')
        return
      }
      changes.push({ id: row.id, price: value, active: activeOf(row) })
    }
    if (changes.length === 0) return
    setSaving(true)
    const results = await Promise.all(
      changes.map(({ id, ...fields }) => supabase!.from('price_list').update(fields).eq('id', id)),
    )
    setSaving(false)
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      notify(failed.error.message, 'error')
    } else {
      notify(changes.length === 1 ? 'Cambio guardado.' : `${changes.length} cambios guardados.`, 'success')
    }
    setPriceDrafts({})
    setActiveDrafts({})
    prices.reload()
  }

  async function addVariant(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const value = toNumber(newPrice)
    if (value === null || Number.isNaN(value) || value < 0) {
      notify('El precio tiene que ser un número.', 'error')
      return
    }
    const { error } = await supabase
      .from('price_list')
      .insert({ size_id: newSize, material_id: newMaterial, finish_id: newFinish, price: value, active: true })
    if (error) {
      notify(error.code === '23505' ? 'Esa variante ya existe.' : error.message, 'error')
      return
    }
    notify('Variante agregada.', 'success')
    setAdding(false)
    setNewSize('')
    setNewMaterial('')
    setNewFinish('')
    setNewPrice('')
    prices.reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox
          id="price-search"
          label="Buscar variante"
          placeholder="Buscar por tamaño, material o acabado"
          value={search}
          onChange={(value) => { setSearch(value); paging.setPage(0) }}
        />
        <div className="w-48">
          <label className="sr-only" htmlFor="price-size">Tamaño</label>
          <select id="price-size" className="input" value={sizeFilter} onChange={(e) => { setSizeFilter(e.target.value); paging.setPage(0) }}>
            <option value="">Todos los tamaños</option>
            {sizes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="w-48">
          <label className="sr-only" htmlFor="price-material">Material</label>
          <select id="price-material" className="input" value={materialFilter} onChange={(e) => { setMaterialFilter(e.target.value); paging.setPage(0) }}>
            <option value="">Todos los materiales</option>
            {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {dirtyRows.length > 0 && <span className="text-sm text-muted">{dirtyRows.length} sin guardar</span>}
          {dirtyRows.length > 0 && (
            <button type="button" className="btn-quiet" disabled={saving} onClick={() => { setPriceDrafts({}); setActiveDrafts({}) }}>Descartar</button>
          )}
          {dirtyRows.length > 0 && (
            <button type="button" className="btn" disabled={saving} onClick={() => void saveAll()}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          )}
          <button type="button" className="btn" onClick={() => setAdding(true)}>Agregar variante</button>
        </div>
      </div>

      {prices.error && <p className="error" role="alert">{prices.error}</p>}
      {!prices.loading && prices.rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-line bg-white px-6 py-8 text-center">
          <p className="font-medium">Todavía no creaste variantes</p>
          <p className="hint mt-1">Con “Agregar variante” elegís tamaño, material, acabado y precio.</p>
        </div>
      )}
      {prices.rows.length > 0 && visible.length === 0 && <p className="hint">Ninguna variante coincide con la búsqueda.</p>}
      {visible.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table>
            <thead>
              <tr>
                <th>Tamaño</th>
                <th>Material</th>
                <th>Acabado</th>
                <th className="w-44">Precio</th>
                <th className="text-center">Activa</th>
              </tr>
            </thead>
            <tbody>
              {paging.paged.map((row) => {
                const label = `${nameOf(sizes, row.size_id)} · ${nameOf(materials, row.material_id)} · ${nameOf(finishes, row.finish_id)}`
                return (
                  <tr key={row.id} className={isDirty(row) ? 'bg-amber-50' : activeOf(row) ? '' : 'text-muted'}>
                    <td className="font-medium">{nameOf(sizes, row.size_id)}</td>
                    <td>{nameOf(materials, row.material_id)}</td>
                    <td>{nameOf(finishes, row.finish_id)}</td>
                    <td>
                      <label className="sr-only" htmlFor={`price-${row.id}`}>Precio de {label}</label>
                      <div className="relative">
                        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
                        <input
                          id={`price-${row.id}`}
                          inputMode="decimal"
                          className="input min-h-9 pl-7 text-right tabular-nums"
                          value={priceOf(row)}
                          onChange={(e) => setPriceDrafts((current) => ({ ...current, [row.id]: e.target.value }))}
                        />
                      </div>
                    </td>
                    <td className="text-center">
                      <label className="inline-flex min-h-9 items-center">
                        <span className="sr-only">Activa: {label}</span>
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={activeOf(row)}
                          onChange={(e) => setActiveDrafts((current) => ({ ...current, [row.id]: e.target.checked }))}
                        />
                      </label>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager paging={paging} label="variantes" id="price-page-size" />

      <Modal open={adding} title="Agregar variante" onClose={() => setAdding(false)}>
        <form onSubmit={addVariant} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {([
              ['Tamaño', newSize, setNewSize, activeSizes],
              ['Material', newMaterial, setNewMaterial, activeMaterials],
              ['Acabado', newFinish, setNewFinish, activeFinishes],
            ] as const).map(([label, value, set, list]) => (
              <div key={label}>
                <label className="label" htmlFor={`new-variant-${label}`}>{label}</label>
                <select id={`new-variant-${label}`} required className="input" value={value} onChange={(e) => set(e.target.value)}>
                  <option value="">Elegí</option>
                  {list.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="sm:max-w-48">
            <label className="label" htmlFor="new-variant-price">Precio</label>
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
              <input id="new-variant-price" required inputMode="decimal" className="input pl-7 text-right tabular-nums" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-quiet" onClick={() => setAdding(false)}>Cancelar</button>
            <button type="submit" className="btn">Agregar variante</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
