import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal.tsx'
import { useToast } from '../../components/toast.ts'
import type { Collection, Finish, Material, PriceRow, Product, Size } from '../../data/types.ts'
import { removeProductFiles, storeProductImage, type StoredImage } from '../../lib/productImageUpload.ts'
import { supabase } from '../../lib/supabase.ts'

const MIN_CAROUSEL = 3
const MAX_CAROUSEL = 5

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

function nextCode(prefix: string, products: Product[]) {
  const used = products
    .filter((p) => p.code.startsWith(`${prefix}-`))
    .map((p) => Number(p.code.slice(prefix.length + 1)))
    .filter((n) => Number.isFinite(n))
  return `${prefix}-${String(Math.max(0, ...used) + 1).padStart(2, '0')}`
}

const money = (value: number) => `$ ${value.toLocaleString('es-AR')}`

interface VariantDraft {
  key: string
  sizeId: string
  materialId: string
  finishId: string
  price: string
  /** Empty means "same as the design". */
  width: string
  height: string
}

const emptyVariant = (): VariantDraft => ({ key: crypto.randomUUID(), sizeId: '', materialId: '', finishId: '', price: '', width: '', height: '' })

/** Object URLs for a list of files, released when the list changes or the modal closes. */
function usePreviews(files: File[]) {
  const urls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files])
  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls])
  return urls
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (productId: string) => void
  collections: Collection[]
  products: Product[]
  sizes: Size[]
  materials: Material[]
  finishes: Finish[]
  prices: PriceRow[]
}

/** Everything a design needs before it can go on the web, asked in one place. It is created inactive. */
export function NewDesignModal({ open, onClose, onCreated, collections, products, sizes, materials, finishes, prices }: Props) {
  const { notify } = useToast()
  const [collectionId, setCollectionId] = useState('')
  const [name, setName] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [description, setDescription] = useState('')
  const [cover, setCover] = useState<File | null>(null)
  const [carousel, setCarousel] = useState<File[]>([])
  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariant()])
  const [busy, setBusy] = useState(false)

  const coverUrls = usePreviews(useMemo(() => (cover ? [cover] : []), [cover]))
  const carouselUrls = usePreviews(carousel)

  const collection = collections.find((c) => c.id === collectionId)
  const code = collection ? nextCode(collection.code, products) : ''

  const reset = () => {
    setCollectionId('')
    setName('')
    setWidth('')
    setHeight('')
    setDescription('')
    setCover(null)
    setCarousel([])
    setVariants([emptyVariant()])
  }
  const close = () => {
    if (busy) return
    onClose()
  }

  const listPrice = (v: VariantDraft) =>
    prices.find((r) => r.active && r.size_id === v.sizeId && r.material_id === v.materialId && r.finish_id === v.finishId)?.price ?? null
  const finalPrice = (v: VariantDraft) => (v.price.trim() !== '' ? Number(v.price) : listPrice(v))
  const variantWidth = (v: VariantDraft) => Number(v.width.trim() !== '' ? v.width : width)
  const variantHeight = (v: VariantDraft) => Number(v.height.trim() !== '' ? v.height : height)
  const patchVariant = (key: string, patch: Partial<VariantDraft>) =>
    setVariants((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  function validate(): string | null {
    if (!collection) return 'Elegí la colección.'
    if (!name.trim()) return 'Escribí el nombre del diseño.'
    if (!(Number(width) > 0) || !(Number(height) > 0)) return 'Cargá el ancho y el alto en milímetros.'
    if (!description.trim()) return 'Escribí la descripción.'
    if (!cover) return 'Subí la portada.'
    if (carousel.length < MIN_CAROUSEL || carousel.length > MAX_CAROUSEL) return `El carrusel necesita de ${MIN_CAROUSEL} a ${MAX_CAROUSEL} fotos.`
    const seen = new Set<string>()
    for (const v of variants) {
      if (!v.sizeId || !v.materialId || !v.finishId) return 'Completá tamaño, material y barnizado de cada variante.'
      if (!(variantWidth(v) > 0) || !(variantHeight(v) > 0)) return 'Cada variante necesita ancho y alto en milímetros.'
      const price = finalPrice(v)
      if (price === null || !Number.isFinite(price) || price < 0) return 'Cada variante necesita un precio. Si no hay precio de lista, escribilo.'
      const combo = `${v.sizeId}|${v.materialId}|${v.finishId}`
      if (seen.has(combo)) return 'Hay dos variantes iguales. Quitá una.'
      seen.add(combo)
    }
    return null
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !collection || !cover) return
    const problem = validate()
    if (problem) {
      notify(problem, 'error')
      return
    }
    setBusy(true)
    const uploaded: StoredImage[] = []
    let productId: string | null = null
    try {
      let slug = slugify(name)
      if (products.some((p) => p.slug === slug)) slug = `${slug}-${code.toLowerCase()}`

      // Files first: the most failure-prone step, and it leaves no database rows behind if it fails.
      const coverImage = await storeProductImage(cover, code)
      uploaded.push(coverImage)
      const carouselImages: StoredImage[] = []
      for (const file of carousel) {
        const stored = await storeProductImage(file, code)
        uploaded.push(stored)
        carouselImages.push(stored)
      }

      const created = await supabase
        .from('products')
        .insert({
          code,
          slug,
          collection_id: collection.id,
          name: name.trim(),
          description: description.trim(),
          width_mm: Number(width),
          height_mm: Number(height),
        })
        .select('id')
        .single()
      if (created.error) throw created.error
      productId = created.data.id as string

      // The SKU is left empty on purpose: the database builds it.
      const variantRows = await supabase.from('product_variants').insert(
        variants.map((v, index) => ({
          product_id: productId,
          size_id: v.sizeId,
          material_id: v.materialId,
          finish_id: v.finishId,
          sku: '',
          width_mm: variantWidth(v),
          height_mm: variantHeight(v),
          price_override: v.price.trim() !== '' ? Number(v.price) : null,
          sort_order: index + 1,
        })),
      )
      if (variantRows.error) throw variantRows.error

      const imageRows = await supabase.from('product_images').insert([
        { product_id: productId, storage_path: coverImage.fullPath, thumb_path: coverImage.thumbPath, sort_order: 0, is_cover: true, alt_text: name.trim() },
        ...carouselImages.map((image, index) => ({
          product_id: productId,
          storage_path: image.fullPath,
          thumb_path: image.thumbPath,
          sort_order: index + 1,
          is_cover: false,
          alt_text: name.trim(),
        })),
      ])
      if (imageRows.error) throw imageRows.error

      notify(`${code} creado. Quedó inactivo: activalo desde la lista.`, 'success')
      const id = productId
      reset()
      onClose()
      onCreated(id)
    } catch (failure) {
      // Nothing half-made stays behind: drop the design (variants and images go with it) and the uploaded files.
      if (productId) await supabase.from('products').delete().eq('id', productId)
      await removeProductFiles(uploaded.flatMap((u) => [u.fullPath, u.thumbPath]))
      const message = failure instanceof Error ? failure.message : 'No pudimos crear el diseño.'
      notify(message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} title="Agregar diseño" onClose={close} wide>
      <form onSubmit={submit} className="space-y-7">
        <section className="space-y-4" aria-labelledby="nd-basics">
          <h3 id="nd-basics" className="text-sm font-semibold">Datos del diseño</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="nd-collection">Colección</label>
              <select id="nd-collection" required className="input" value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
                <option value="">Elegí una</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
                ))}
              </select>
              {code && <p className="mt-1 text-xs text-muted">Se crea como {code}.</p>}
            </div>
            <div>
              <label className="label" htmlFor="nd-name">Nombre</label>
              <input id="nd-name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="nd-width">Ancho (mm)</label>
              <input id="nd-width" required type="number" min="1" step="any" className="input" value={width} onChange={(e) => setWidth(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="nd-height">Alto (mm)</label>
              <input id="nd-height" required type="number" min="1" step="any" className="input" value={height} onChange={(e) => setHeight(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="nd-description">Descripción</label>
            <textarea id="nd-description" required rows={3} className="input py-2" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </section>

        <section className="space-y-4" aria-labelledby="nd-images">
          <h3 id="nd-images" className="text-sm font-semibold">Imágenes</h3>
          <div className="space-y-2">
            <p className="text-sm font-medium">Portada</p>
            <div className="flex flex-wrap items-center gap-3">
              {coverUrls[0] && <img src={coverUrls[0]} alt="" className="size-20 rounded-lg border border-line object-cover" />}
              <label htmlFor="nd-cover" className="btn-quiet cursor-pointer">{cover ? 'Cambiar portada' : 'Elegir portada'}</label>
              <input id="nd-cover" type="file" accept="image/*" className="sr-only" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
              {cover && <span className="hint max-w-52 truncate">{cover.name}</span>}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">Carrusel</p>
              <span className={carousel.length >= MIN_CAROUSEL && carousel.length <= MAX_CAROUSEL ? 'chip chip-ok' : 'chip chip-warn'}>
                {carousel.length} de {MAX_CAROUSEL} · mínimo {MIN_CAROUSEL}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {carouselUrls.map((url, index) => (
                <img key={url} src={url} alt="" className="size-16 rounded-lg border border-line object-cover" title={carousel[index]?.name} />
              ))}
              <label htmlFor="nd-carousel" className="btn-quiet cursor-pointer">{carousel.length ? 'Cambiar fotos' : 'Elegir fotos'}</label>
              <input
                id="nd-carousel"
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => setCarousel(Array.from(e.target.files ?? []).slice(0, MAX_CAROUSEL))}
              />
            </div>
            <p className="hint">Elegí de {MIN_CAROUSEL} a {MAX_CAROUSEL} fotos a la vez. Después podés cambiar el carrusel por variante.</p>
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="nd-variants">
          <div className="flex items-center justify-between gap-3">
            <h3 id="nd-variants" className="text-sm font-semibold">Variantes y precio</h3>
            <button type="button" className="btn-quiet min-h-9 px-3" onClick={() => setVariants((rows) => [...rows, emptyVariant()])}>
              Otra variante
            </button>
          </div>
          <ul className="space-y-3">
            {variants.map((v, index) => {
              const list = listPrice(v)
              const ready = v.sizeId && v.materialId && v.finishId
              return (
                <li key={v.key} className="rounded-xl border border-line bg-white p-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {([
                      ['Tamaño', 'sizeId', v.sizeId, sizes],
                      ['Material', 'materialId', v.materialId, materials],
                      ['Barnizado', 'finishId', v.finishId, finishes],
                    ] as const).map(([label, field, value, options]) => (
                      <div key={field}>
                        <label className="mb-1 block text-xs text-muted" htmlFor={`nd-${v.key}-${field}`}>{label}</label>
                        <select id={`nd-${v.key}-${field}`} required className="input" value={value} onChange={(e) => patchVariant(v.key, { [field]: e.target.value })}>
                          <option value="">Elegí</option>
                          {options.filter((o) => o.active).map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                    <div className="flex flex-wrap items-end gap-3">
                    {([
                      ['Ancho (mm)', 'width', v.width, width],
                      ['Alto (mm)', 'height', v.height, height],
                    ] as const).map(([label, field, value, fallback]) => (
                      <div key={field} className="w-32">
                        <label className="mb-1 block text-xs text-muted" htmlFor={`nd-${v.key}-${field}`}>{label}</label>
                        <input
                          id={`nd-${v.key}-${field}`}
                          type="number"
                          min="1"
                          step="any"
                          className="input"
                          placeholder={fallback || ''}
                          value={value}
                          onChange={(e) => patchVariant(v.key, { [field]: e.target.value })}
                        />
                      </div>
                    ))}
                    <div className="w-48">
                      <label className="mb-1 block text-xs text-muted" htmlFor={`nd-${v.key}-price`}>
                        Precio {list !== null ? '(opcional)' : ''}
                      </label>
                      <input
                        id={`nd-${v.key}-price`}
                        type="number"
                        min="0"
                        step="any"
                        required={Boolean(ready) && list === null}
                        className="input"
                        placeholder={list !== null ? String(list) : 'Ej: 3000'}
                        value={v.price}
                        onChange={(e) => patchVariant(v.key, { price: e.target.value })}
                      />
                      {ready && (
                        <p className="mt-1 text-xs text-muted">
                          {list !== null ? `Precio de lista: ${money(list)}. Escribí uno solo para cambiarlo.` : 'No hay precio de lista para esta combinación.'}
                        </p>
                      )}
                    </div>
                    </div>
                    {variants.length > 1 && (
                      <button type="button" className="text-sm text-danger underline-offset-2 hover:underline" onClick={() => setVariants((rows) => rows.filter((r) => r.key !== v.key))}>
                        Quitar variante {index + 1}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
          {busy && <span role="status" className="hint">Creando el diseño y subiendo fotos…</span>}
          <button type="button" className="btn-quiet" disabled={busy} onClick={close}>Cancelar</button>
          <button type="submit" className="btn" disabled={busy}>{code ? `Crear ${code}` : 'Crear diseño'}</button>
        </div>
      </form>
    </Modal>
  )
}
