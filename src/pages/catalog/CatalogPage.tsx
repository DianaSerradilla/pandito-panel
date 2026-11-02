import { Fragment, useState } from 'react'
import { Link } from 'react-router'
import type { Collection, Finish, Material, PriceRow, Product, Size, Variant } from '../../data/types.ts'
import { Modal } from '../../components/Modal.tsx'
import { SyncSheetButton } from '../../components/SyncSheetButton.tsx'
import { Thumb } from '../../components/Thumb.tsx'
import { useToast } from '../../components/toast.ts'
import { designStateChip, designStatus, type DesignState } from '../../data/designStatus.ts'
import { formatMeasures } from '../../data/measures.ts'
import { useCovers } from '../../data/useCovers.ts'
import { useRows } from '../../data/useRows.ts'
import { supabase } from '../../lib/supabase.ts'
import { NewDesignModal } from './NewDesignModal.tsx'
import { VariantsPanel, type VariantStock } from './VariantsPanel.tsx'

const nowIso = () => new Date().toISOString()

export function CatalogPage() {
  const { notify } = useToast()
  const products = useRows<Product>('products', ['code'])
  const collections = useRows<Collection>('collections', ['sort_order'])
  const variants = useRows<Variant>('product_variants', ['sku'])
  const prices = useRows<PriceRow>('price_list')
  const sizes = useRows<Size>('sizes', ['sort_order'])
  const materials = useRows<Material>('materials', ['sort_order'])
  const finishes = useRows<Finish>('finishes', ['sort_order'])
  const stockRows = useRows<VariantStock>('variant_stock')
  const { covers, carousel, reload: reloadCovers } = useCovers()
  const [filter, setFilter] = useState('')
  const [stateFilter, setStateFilter] = useState<DesignState | ''>('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [pickCoverFor, setPickCoverFor] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [toArchive, setToArchive] = useState<Product | null>(null)

  const collectionById = new Map(collections.rows.map((c) => [c.id, c]))
  const variantsByProduct = new Map<string, Variant[]>()
  for (const v of variants.rows) variantsByProduct.set(v.product_id, [...(variantsByProduct.get(v.product_id) ?? []), v])
  const stock = new Map(stockRows.rows.map((s) => [s.variant_id, s]))
  const priceOf = (v: Variant) =>
    v.price_override ??
    prices.rows.find((r) => r.active && r.material_id === v.material_id && r.finish_id === v.finish_id && r.size_id === v.size_id)?.price ??
    null
  const statusOf = (p: Product) => designStatus(p, variantsByProduct.get(p.id) ?? [], covers.has(p.id), carousel.get(p.id) ?? 0, priceOf)
  const toggleOpen = (id: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  const reloadAll = () => {
    products.reload()
    collections.reload()
    variants.reload()
    stockRows.reload()
    reloadCovers()
  }

  const needle = search.trim().toLowerCase()
  const archivedCount = products.rows.filter((p) => p.archived_at).length
  const visible = products.rows.filter(
    (p) =>
      (showArchived ? Boolean(p.archived_at) : !p.archived_at) &&
      (!filter || p.collection_id === filter) &&
      (!stateFilter || statusOf(p).state === stateFilter) &&
      (!needle || p.name.toLowerCase().includes(needle) || p.code.toLowerCase().includes(needle)),
  )

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const firstShown = currentPage * pageSize
  const paged = visible.slice(firstShown, firstShown + pageSize)

  async function toggleActive(product: Product) {
    if (!supabase) return
    const { missing } = statusOf(product)
    if (!product.published && missing.length > 0) {
      notify(`${product.code} no se puede activar: falta ${missing.join(', ')}.`, 'error')
      return
    }
    const { error: failure } = await supabase.from('products').update({ published: !product.published }).eq('id', product.id)
    if (failure) {
      notify(failure.message, 'error')
      return
    }
    notify(product.published ? `${product.code} desactivado.` : `${product.code} activado en la web.`, 'success')
    products.reload()
  }

  async function setArchived(product: Product, archive: boolean) {
    if (!supabase) return
    const { error: failure } = await supabase
      .from('products')
      .update({ archived_at: archive ? nowIso() : null })
      .eq('id', product.id)
    if (failure) {
      notify(failure.message, 'error')
      return
    }
    notify(archive ? `${product.code} archivado. Salió de la web y de Ventas.` : `${product.code} restaurado. Sigue inactivo hasta que lo actives.`, 'success')
    setToArchive(null)
    reloadAll()
  }

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Diseños</h1>

      <Modal open={toArchive !== null} title="Archivar diseño" onClose={() => setToArchive(null)}>
        <div className="space-y-4">
          <p className="text-sm">
            <strong>{toArchive?.name}</strong> se desactiva y sale de la web, de Ventas y de las solicitudes. El historial y el stock se conservan, y lo podés restaurar cuando quieras.
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="btn-quiet min-h-12" onClick={() => setToArchive(null)}>Cancelar</button>
            <button type="button" className="btn min-h-12" onClick={() => toArchive && void setArchived(toArchive, true)}>Archivar</button>
          </div>
        </div>
      </Modal>

      <section className="card space-y-4" aria-labelledby="products-title">
        <div>
          <h2 id="products-title" className="text-lg font-semibold">Todos los diseños</h2>
          <p className="hint">{visible.length} de {products.rows.length} diseños</p>
        </div>

        <NewDesignModal
          open={adding}
          onClose={() => setAdding(false)}
          onCreated={(id) => {
            setOpen((current) => new Set(current).add(id))
            reloadAll()
          }}
          collections={collections.rows}
          products={products.rows}
          sizes={sizes.rows}
          materials={materials.rows}
          finishes={finishes.rows}
          prices={prices.rows}
        />

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1 sm:max-w-sm">
            <svg aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="18" height="18" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <label htmlFor="product-search" className="sr-only">Buscar diseño</label>
            <input
              id="product-search"
              type="search"
              className="input pl-10"
              placeholder="Buscar por nombre o código"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            />
          </div>
          <div className="w-52">
            <label htmlFor="product-filter" className="sr-only">Colección</label>
            <select id="product-filter" className="input" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0) }}>
              <option value="">Todas las colecciones</option>
              {collections.rows.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="w-52">
            <label htmlFor="product-state" className="sr-only">Estado</label>
            <select id="product-state" className="input" value={stateFilter} onChange={(e) => { setStateFilter(e.target.value as DesignState | ''); setPage(0) }}>
              <option value="">Todos los estados</option>
              {(Object.keys(designStateChip) as DesignState[]).map((state) => (
                <option key={state} value={state}>{designStateChip[state].label}</option>
              ))}
            </select>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={showArchived} onChange={(e) => { setShowArchived(e.target.checked); setPage(0) }} />
            Archivados ({archivedCount})
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <SyncSheetButton onDone={reloadAll} />
            <button type="button" className="btn" onClick={() => setAdding(true)}>Agregar diseño</button>
          </div>
        </div>

        {products.loading && <p className="hint" role="status">Cargando…</p>}
        {products.error && <p className="error" role="alert">{products.error}</p>}
        {!products.loading && visible.length === 0 && (
          <p className="hint">
            {products.rows.length === 0
              ? 'Todavía no hay diseños. Usá «Agregar diseño» o sincronizá con la planilla.'
              : 'Ningún diseño coincide con la búsqueda o los filtros. Probá quitarlos.'}
          </p>
        )}

        {visible.length > 0 && (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Diseño</th>
                  <th>Colección</th>
                  <th>Estado</th>
                  <th className="text-right">Variantes</th>
                  <th className="text-right">Stock</th>
                  <th>Activo</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {paged.map((p) => {
                  const own = variantsByProduct.get(p.id) ?? []
                  const status = statusOf(p)
                  const chip = designStateChip[status.state]
                  const isOpen = open.has(p.id)
                  const totalStock = own.reduce((sum, v) => sum + (stock.get(v.id)?.on_hand ?? 0), 0)
                  const blocked = !p.published && status.missing.length > 0
                  return (
                    <Fragment key={p.id}>
                      <tr
                        className={`cursor-pointer transition-colors hover:bg-crema/40 ${isOpen ? 'bg-crema/40' : ''}`}
                        onClick={() => toggleOpen(p.id)}
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            {covers.has(p.id) ? (
                              <Thumb path={covers.get(p.id)} />
                            ) : (
                              <button
                                type="button"
                                aria-label={`Subir portada de ${p.name}`}
                                title="Subir portada"
                                className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-naranja-dark/50 text-naranja-dark hover:bg-naranja-dark/10"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpen((current) => new Set(current).add(p.id))
                                  setPickCoverFor(p.id)
                                }}
                              >
                                <svg aria-hidden width="18" height="18" viewBox="0 0 16 16" fill="none">
                                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                                </svg>
                              </button>
                            )}
                            <div className="min-w-0">
                              <Link
                                to={`/catalogo/${p.id}`}
                                className="block text-base font-semibold underline-offset-2 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {p.name}
                              </Link>
                              <p className="text-xs text-muted">
                                {p.code}
                                {formatMeasures(p.width_mm, p.height_mm) && <span> · {formatMeasures(p.width_mm, p.height_mm)}</span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="text-muted">{collectionById.get(p.collection_id)?.name ?? '—'}</td>
                        <td>
                          <span className={chip.className} title={status.missing.length > 0 ? `Falta: ${status.missing.join(', ')}` : undefined}>
                            {chip.label}
                          </span>
                        </td>
                        <td className="text-right tabular-nums">{own.length}</td>
                        <td className={`text-right tabular-nums ${totalStock === 0 ? 'text-muted' : 'font-semibold'}`}>{totalStock}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <label className="flex min-h-11 items-center gap-2 text-sm">
                            <input type="checkbox" checked={p.published} aria-disabled={blocked} onChange={() => void toggleActive(p)} />
                            <span className={p.published ? 'text-ok' : 'text-muted'}>{p.published ? 'Activo' : 'Inactivo'}</span>
                          </label>
                        </td>
                        <td className="whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="mr-2 inline-flex size-9 items-center justify-center rounded-lg border border-line bg-white text-muted hover:bg-crema/60"
                            aria-label={`${p.archived_at ? 'Restaurar' : 'Archivar'} ${p.name}`}
                            title={p.archived_at ? 'Restaurar' : 'Archivar'}
                            onClick={() => (p.archived_at ? void setArchived(p, false) : setToArchive(p))}
                          >
                            <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
                              {p.archived_at ? (
                                <path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                              ) : (
                                <path d="M2.5 4h11v2.5h-11zM3.5 6.5v6h9v-6M6.5 9h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                              )}
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="inline-flex size-9 items-center justify-center rounded-lg border border-line bg-white text-muted hover:bg-crema/60"
                            aria-expanded={isOpen}
                            aria-label={`${isOpen ? 'Ocultar' : 'Ver'} detalle de ${p.name}`}
                            onClick={() => toggleOpen(p.id)}
                          >
                            <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none" className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                              <path d="M2 4.5 7 9.5l5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={7} className="p-0">
                            <VariantsPanel
                              product={p}
                              variants={own}
                              stock={stock}
                              priceOf={priceOf}
                              sizes={sizes.rows}
                              materials={materials.rows}
                              finishes={finishes.rows}
                              onChanged={reloadAll}
                              pickCover={pickCoverFor === p.id}
                              onPickHandled={() => setPickCoverFor(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {visible.length > 0 && (
          <nav aria-label="Paginación de diseños" className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="hint">
              Mostrando {firstShown + 1}–{firstShown + paged.length} de {visible.length}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-muted" htmlFor="page-size">
                Por página
                <select
                  id="page-size"
                  className="input min-h-9 w-20 py-0 text-sm"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0) }}
                >
                  {[10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="btn-quiet min-h-9 px-3" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
                Anterior
              </button>
              <span className="text-sm tabular-nums">Página {currentPage + 1} de {pageCount}</span>
              <button type="button" className="btn-quiet min-h-9 px-3" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>
                Siguiente
              </button>
            </div>
          </nav>
        )}
      </section>
    </div>
  )
}
