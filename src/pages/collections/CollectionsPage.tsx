import { useState, type FormEvent } from 'react'
import { designStatus } from '../../data/designStatus.ts'
import type { Collection, PriceRow, Product, Variant } from '../../data/types.ts'
import { useCovers } from '../../data/useCovers.ts'
import { useRows } from '../../data/useRows.ts'
import { Combobox } from '../../components/Combobox.tsx'
import { Modal } from '../../components/Modal.tsx'
import { Pager } from '../../components/Pager.tsx'
import { usePaging } from '../../components/usePaging.ts'
import { useToast } from '../../components/toast.ts'
import { removeProductFiles } from '../../lib/productImageUpload.ts'
import { supabase } from '../../lib/supabase.ts'

const statusLabels: Record<string, string> = {
  on_sale: 'En venta',
  test: 'En prueba',
  client_only: 'Solo al cliente',
  gift: 'Regalo',
  internal: 'Uso interno',
}

const productTypes: Record<string, string> = { sticker: 'Sticker' }

interface RowProps {
  collection: Collection
  count: number
  activeCount: number
  kinds: string[]
  onSaved: () => void
  onToggleActive: (collection: Collection, active: boolean) => void
  onDelete: (collection: Collection) => void
}

function CollectionRow({ collection, count, activeCount, kinds, onSaved, onToggleActive, onDelete }: RowProps) {
  const [name, setName] = useState(collection.name)
  const [kind, setKind] = useState(collection.kind ?? '')
  const [productType, setProductType] = useState(collection.product_type)
  const [status, setStatus] = useState(collection.sale_status)
  const { notify } = useToast()
  const dirty =
    name !== collection.name ||
    kind !== (collection.kind ?? '') ||
    productType !== collection.product_type ||
    status !== collection.sale_status

  async function save() {
    if (!supabase) return
    const { error } = await supabase
      .from('collections')
      .update({ name: name.trim(), kind: kind.trim() || null, product_type: productType, sale_status: status })
      .eq('id', collection.id)
    if (error) {
      notify(error.message, 'error')
      return
    }
    notify(`Colección ${collection.code} guardada.`, 'success')
    onSaved()
  }

  const id = `col-${collection.id}`
  return (
    <tr>
      <td className="whitespace-nowrap text-muted">{collection.code}</td>
      <td>
        <label className="sr-only" htmlFor={`${id}-name`}>Nombre de {collection.code}</label>
        <input id={`${id}-name`} className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </td>
      <td>
        <label className="sr-only" htmlFor={`${id}-kind`}>Tema de {collection.code}</label>
        <Combobox id={`${id}-kind`} value={kind} onChange={setKind} options={kinds} noun="tema" />
      </td>
      <td>
        <label className="sr-only" htmlFor={`${id}-type`}>Producto de {collection.code}</label>
        <select id={`${id}-type`} className="input" value={productType} onChange={(e) => setProductType(e.target.value)}>
          {Object.entries(productTypes).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
      </td>
      <td>
        <label className="sr-only" htmlFor={`${id}-status`}>Estado de {collection.code}</label>
        <select id={`${id}-status`} className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          {Object.entries(statusLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
      </td>
      <td className="whitespace-nowrap">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={activeCount > 0}
            disabled={count === 0}
            onChange={(e) => onToggleActive(collection, e.target.checked)}
          />
          <span className={activeCount > 0 ? 'text-ok' : 'text-muted'}>{activeCount > 0 ? 'Activa' : 'Inactiva'}</span>
        </label>
      </td>
      <td className="whitespace-nowrap text-right tabular-nums">
        {count}
        <span className="block text-xs text-muted">{activeCount} activos</span>
      </td>
      <td className="whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-2">
          <button type="button" className={dirty ? 'btn' : 'btn-quiet'} disabled={!dirty} onClick={() => void save()}>Guardar</button>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-lg border border-line bg-white text-danger hover:bg-red-50"
            aria-label={`Borrar colección ${collection.code}`}
            title="Borrar colección y sus stickers"
            onClick={() => onDelete(collection)}
          >
            <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.6 9h6.8L12 4M6.8 6.5v4M9.2 6.5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}

/** Collections. The 2-letter code is the prefix of every design code, so it is set once. */
export function CollectionsPage() {
  const collections = useRows<Collection>('collections', ['sort_order'])
  const products = useRows<Product>('products', ['code'])
  const variants = useRows<Variant>('product_variants')
  const prices = useRows<PriceRow>('price_list')
  const { covers, carousel } = useCovers()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState('')
  const [productType, setProductType] = useState('sticker')
  const [status, setStatus] = useState('test')
  const [search, setSearch] = useState('')
  const [coverage, setCoverage] = useState<'' | 'empty'>('')
  const [adding, setAdding] = useState(false)
  const [toDelete, setToDelete] = useState<Collection | null>(null)
  const [confirmCode, setConfirmCode] = useState('')
  const [deleting, setDeleting] = useState(false)
  const { notify } = useToast()

  const needle = search.trim().toLowerCase()
  const liveByCollection = new Set(products.rows.filter((p) => p.published).map((p) => p.collection_id))
  const shown = collections.rows.filter(
    (c) => (coverage !== 'empty' || !liveByCollection.has(c.id)) && (!needle || c.code.toLowerCase().includes(needle) || c.name.toLowerCase().includes(needle) || (c.kind ?? '').toLowerCase().includes(needle)),
  )

  const paging = usePaging(shown)
  const counts = new Map<string, number>()
  for (const p of products.rows) counts.set(p.collection_id, (counts.get(p.collection_id) ?? 0) + 1)
  const activeCounts = new Map<string, number>()
  for (const p of products.rows) if (p.published) activeCounts.set(p.collection_id, (activeCounts.get(p.collection_id) ?? 0) + 1)
  const kinds = [...new Set(collections.rows.map((c) => c.kind).filter((k): k is string => Boolean(k)))]

  const variantsByProduct = new Map<string, Variant[]>()
  for (const v of variants.rows) variantsByProduct.set(v.product_id, [...(variantsByProduct.get(v.product_id) ?? []), v])
  const priceOf = (v: Variant) =>
    v.price_override ??
    prices.rows.find((r) => r.active && r.material_id === v.material_id && r.finish_id === v.finish_id && r.size_id === v.size_id)?.price ??
    null

  /**
   * Off: every sticker of the collection becomes inactive. On: only the stickers that already have
   * everything the web needs are activated, same rule as activating one design in Diseños.
   */
  async function setCollectionActive(collection: Collection, active: boolean) {
    if (!supabase) return
    const own = products.rows.filter((p) => p.collection_id === collection.id)
    if (!active) {
      const { error } = await supabase.from('products').update({ published: false }).eq('collection_id', collection.id)
      if (error) {
        notify(error.message, 'error')
        return
      }
      notify(`Todos los stickers de ${collection.code} quedaron inactivos.`, 'success')
      products.reload()
      return
    }
    const ready = own.filter(
      (p) => !p.published && designStatus(p, variantsByProduct.get(p.id) ?? [], covers.has(p.id), carousel.get(p.id) ?? 0, priceOf).missing.length === 0,
    )
    const incomplete = own.filter((p) => !p.published).length - ready.length
    if (ready.length === 0) {
      notify(`Ningún sticker de ${collection.code} está completo para activarse. Completalos en Diseños.`, 'error')
      return
    }
    const { error } = await supabase.from('products').update({ published: true }).in('id', ready.map((p) => p.id))
    if (error) {
      notify(error.message, 'error')
      return
    }
    notify(
      incomplete > 0
        ? `${ready.length} activados en ${collection.code}. ${incomplete} quedaron inactivos por datos faltantes.`
        : `Todos los stickers de ${collection.code} quedaron activos.`,
      'success',
    )
    products.reload()
  }

  async function deleteCollection() {
    if (!supabase || !toDelete) return
    setDeleting(true)
    const ids = products.rows.filter((p) => p.collection_id === toDelete.id).map((p) => p.id)
    const { data: images } = ids.length
      ? await supabase.from('product_images').select('storage_path, thumb_path').in('product_id', ids)
      : { data: [] }
    const { error: productsError } = await supabase.from('products').delete().eq('collection_id', toDelete.id)
    if (productsError) {
      setDeleting(false)
      notify(
        productsError.code === '23503'
          ? 'Hay stickers con ventas o movimientos de stock, no se pueden borrar. Usá “Desactivar todos”.'
          : productsError.message,
        'error',
      )
      products.reload()
      return
    }
    const { error } = await supabase.from('collections').delete().eq('id', toDelete.id)
    setDeleting(false)
    if (error) {
      notify(error.message, 'error')
      products.reload()
      return
    }
    await removeProductFiles((images ?? []).flatMap((i) => [i.storage_path, i.thumb_path]))
    notify(`Colección ${toDelete.code} y ${ids.length} ${ids.length === 1 ? 'sticker borrados' : 'stickers borrados'}.`, 'success')
    setToDelete(null)
    setConfirmCode('')
    collections.reload()
    products.reload()
  }

  async function add(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const { error } = await supabase.from('collections').insert({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      kind: kind.trim() || null,
      product_type: productType,
      sale_status: status,
      sort_order: collections.rows.length + 1,
    })
    if (error) {
      notify(error.code === '23514' ? 'El código son 2 letras (por ejemplo GC).' : error.message, 'error')
      return
    }
    notify(`Colección ${code.trim().toUpperCase()} creada.`, 'success')
    setCode('')
    setName('')
    setKind('')
    setProductType('sticker')
    setStatus('test')
    setAdding(false)
    collections.reload()
  }

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Colecciones</h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <svg aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="18" height="18" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <label className="sr-only" htmlFor="collection-search">Buscar colección</label>
          <input
            id="collection-search"
            type="search"
            className="input pl-10"
            placeholder="Buscar por código, nombre o tema"
            value={search}
            onChange={(e) => { setSearch(e.target.value); paging.setPage(0) }}
          />
        </div>
        <div className="w-56">
          <label className="sr-only" htmlFor="collection-coverage">Estado</label>
          <select id="collection-coverage" className="input" value={coverage} onChange={(e) => { setCoverage(e.target.value as '' | 'empty'); paging.setPage(0) }}>
            <option value="">Todas</option>
            <option value="empty">Sin diseños activos</option>
          </select>
        </div>
        <button type="button" className="btn" onClick={() => setAdding(true)}>Agregar colección</button>
      </div>

      <Modal open={adding} title="Agregar colección" onClose={() => setAdding(false)}>
        <form onSubmit={add} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <div>
              <label className="label" htmlFor="col-new-code">Código</label>
              <input id="col-new-code" required maxLength={2} pattern="[A-Za-z]{2}" title="Dos letras, por ejemplo GC" className="input uppercase" value={code} onChange={(e) => setCode(e.target.value)} />
              <p className="mt-1 text-xs text-muted">2 letras. Es el prefijo de sus diseños.</p>
            </div>
            <div>
              <label className="label" htmlFor="col-new-name">Nombre</label>
              <input id="col-new-name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="col-new-kind">Tema</label>
            <Combobox id="col-new-kind" value={kind} onChange={setKind} options={kinds} placeholder="Elegí uno o escribí uno nuevo" noun="tema" />
            <p className="mt-1 text-xs text-muted">Los temas salen de las colecciones que ya cargaste.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="col-new-type">Producto</label>
              <select id="col-new-type" required className="input" value={productType} onChange={(e) => setProductType(e.target.value)}>
                {Object.entries(productTypes).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="col-new-status">Estado de venta</label>
              <select id="col-new-status" required className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                {Object.entries(statusLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-quiet" onClick={() => setAdding(false)}>Cancelar</button>
            <button type="submit" className="btn">Crear colección</button>
          </div>
        </form>
      </Modal>

      <Modal open={toDelete !== null} title="Borrar colección" onClose={() => !deleting && setToDelete(null)}>
        {toDelete && (() => {
          const total = counts.get(toDelete.id) ?? 0
          return (
            <form
              onSubmit={(event) => { event.preventDefault(); void deleteCollection() }}
              className="space-y-4"
            >
              <p>
                Vas a borrar la colección <strong>{toDelete.code} · {toDelete.name}</strong>
                {total > 0
                  ? <> y <strong>sus {total} {total === 1 ? 'sticker' : 'stickers'}</strong>, con sus variantes, precios y fotos.</>
                  : '. No tiene stickers.'}
              </p>
              <p className="text-sm text-danger">Esta acción no se puede deshacer.</p>
              <p className="hint">Si solo querés sacarlos de la web, cerrá esto y usá “Desactivar todos”: los stickers quedan inactivos pero se conservan.</p>
              <div>
                <label className="label" htmlFor="col-delete-confirm">Escribí {toDelete.code} para confirmar</label>
                <input id="col-delete-confirm" className="input uppercase sm:max-w-40" autoComplete="off" value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-quiet" disabled={deleting} onClick={() => setToDelete(null)}>Cancelar</button>
                <button type="submit" className="btn" disabled={deleting || confirmCode.trim().toUpperCase() !== toDelete.code}>
                  {deleting ? 'Borrando…' : total > 0 ? `Borrar colección y ${total} ${total === 1 ? 'sticker' : 'stickers'}` : 'Borrar colección'}
                </button>
              </div>
            </form>
          )
        })()}
      </Modal>

      <section className="card overflow-x-auto">
        {collections.loading && <p className="hint" role="status">Cargando…</p>}
        {collections.error && <p className="error" role="alert">{collections.error}</p>}
        {!collections.loading && collections.rows.length === 0 && <p className="hint">Todavía no hay colecciones. Creá la primera con «Agregar colección».</p>}
        {collections.rows.length > 0 && shown.length === 0 && <p className="hint">Ninguna colección coincide con la búsqueda.</p>}
        {shown.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Tema</th>
                <th>Producto</th>
                <th>Estado</th>
                <th>Web</th>
                <th className="text-right">Stickers</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {paging.paged.map((c) => (
                <CollectionRow
                  key={`${c.id}-${c.name}-${c.kind}-${c.sale_status}`}
                  collection={c}
                  count={counts.get(c.id) ?? 0}
                  activeCount={activeCounts.get(c.id) ?? 0}
                  kinds={kinds}
                  onSaved={collections.reload}
                  onToggleActive={(collection, active) => void setCollectionActive(collection, active)}
                  onDelete={(collection) => { setConfirmCode(''); setToDelete(collection) }}
                />
              ))}
            </tbody>
          </table>
        )}
        <Pager paging={paging} label="colecciones" id="collection-page-size" />
      </section>
    </div>
  )
}
