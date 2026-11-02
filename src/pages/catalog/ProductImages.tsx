import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type { Finish, Material, Product, ProductImage, Size, Variant } from '../../data/types.ts'
import { useRows } from '../../data/useRows.ts'
import { removeProductFiles as removeFiles, storeProductImage as store } from '../../lib/productImageUpload.ts'
import { productImageUrl } from '../../lib/storage.ts'
import { useToast } from '../../components/toast.ts'
import { supabase } from '../../lib/supabase.ts'

const MIN_CAROUSEL = 3
const MAX_CAROUSEL = 5

const nameOf = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? '?'

const ICONS = {
  left: 'M10 3 5 8l5 5',
  right: 'M6 3l5 5-5 5',
  plus: 'M8 3v10M3 8h10',
  pencil: 'M2.5 13.5l.7-3L11 2.7a1.4 1.4 0 0 1 2 2L5.2 12.5l-2.7 1Z',
  eye: 'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8ZM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  eyeOff: 'M2 2l12 12M6.4 3.7A6 6 0 0 1 8 3.5C12 3.5 14.5 8 14.5 8a10 10 0 0 1-2.1 2.6M4 5.4A10 10 0 0 0 1.5 8S4 12.5 8 12.5a6 6 0 0 0 2.3-.5',
  trash: 'M2.5 4h11M6 4V2.5h4V4M4 4l.6 9h6.8L12 4M6.8 6.5v4M9.2 6.5v4',
}

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d={ICONS[name]} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconButton({ icon, label, onClick, disabled, danger }: { icon: keyof typeof ICONS; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex size-7 items-center justify-center rounded-md border border-line bg-white hover:bg-crema disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white ${danger ? 'text-danger hover:bg-red-50' : 'text-ink'}`}
    >
      <Icon name={icon} />
    </button>
  )
}

interface Props {
  product: Product
  onChanged: () => void
  /** Opens the file picker for the cover as soon as the images are loaded (used by the "+" in the list). */
  pickCover?: boolean
  onPickHandled?: () => void
}

/**
 * Photos of a design. One cover shared by every variant, and a carousel of 3 to 5 photos that can be
 * shared or, for a given variant, replaced by photos of that variant only.
 */
export function ProductImages({ product, onChanged, pickCover, onPickHandled }: Props) {
  const all = useRows<ProductImage>('product_images', ['sort_order'])
  const allVariants = useRows<Variant>('product_variants', ['sku'])
  const sizes = useRows<Size>('sizes', ['sort_order'])
  const materials = useRows<Material>('materials', ['sort_order'])
  const finishes = useRows<Finish>('finishes', ['sort_order'])
  const [busy, setBusy] = useState(false)
  const [scope, setScope] = useState('') // '' = shared carousel, otherwise a variant id
  const [editing, setEditing] = useState<ProductImage | null>(null)
  const [brokenCover, setBrokenCover] = useState<string | null>(null)
  const [altDraft, setAltDraft] = useState('')
  const coverInput = useRef<HTMLInputElement>(null)
  const { notify } = useToast()

  const variants = allVariants.rows.filter((v) => v.product_id === product.id)
  const own = all.rows.filter((i) => i.product_id === product.id)
  const cover = own.find((i) => i.is_cover)
  const carouselOf = (variantId: string | null) =>
    own.filter((i) => !i.is_cover && i.variant_id === variantId).sort((a, b) => a.sort_order - b.sort_order)
  const scopeVariantId = scope || null
  const images = carouselOf(scopeVariantId)
  const variantLabel = (v: Variant) => `${nameOf(sizes.rows, v.size_id)} · ${nameOf(materials.rows, v.material_id)} · ${nameOf(finishes.rows, v.finish_id)}`
  const scopeVariant = variants.find((v) => v.id === scopeVariantId)

  /** Alt text used when nobody writes one: the sticker name, plus the variant for variant photos. */
  const defaultAlt = (variantId: string | null) => {
    const variant = variants.find((v) => v.id === variantId)
    return variant ? `${product.name} · ${variantLabel(variant)}` : product.name
  }
  const altOf = (image: ProductImage) => image.alt_text?.trim() || defaultAlt(image.variant_id)

  const refresh = () => {
    all.reload()
    onChanged()
  }

  // The "+" in the designs list asks for the cover picker to open once the panel is ready.
  useEffect(() => {
    if (!pickCover || all.loading) return
    onPickHandled?.()
    if (!cover) coverInput.current?.click()
  }, [pickCover, all.loading, cover, onPickHandled])

  async function uploadCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!supabase || !file) return
    setBusy(true)
    try {
      const { fullPath, thumbPath } = await store(file, product.code)
      // Replacing keeps the same row, so the cover is never missing and the one-cover rule is never broken.
      const { error: failure } = cover
        ? await supabase.from('product_images').update({ storage_path: fullPath, thumb_path: thumbPath }).eq('id', cover.id)
        : await supabase
            .from('product_images')
            .insert({ product_id: product.id, storage_path: fullPath, thumb_path: thumbPath, sort_order: 0, is_cover: true, alt_text: defaultAlt(null) })
      if (failure) {
        await removeFiles([fullPath, thumbPath])
        throw failure
      }
      if (cover) await removeFiles([cover.storage_path, cover.thumb_path])
      notify(cover ? 'Portada reemplazada.' : 'Portada subida.', 'success')
    } catch (failure) {
      notify(failure instanceof Error ? failure.message : 'No pudimos subir la portada.', 'error')
    } finally {
      setBusy(false)
      refresh()
    }
  }

  async function uploadCarousel(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!supabase || chosen.length === 0) return
    const room = MAX_CAROUSEL - images.length
    if (room <= 0) {
      notify(`El carrusel ya tiene ${MAX_CAROUSEL} fotos. Quitá una para subir otra.`, 'error')
      return
    }
    const files = chosen.slice(0, room)
    setBusy(true)
    let order = Math.max(0, ...images.map((i) => i.sort_order)) + 1
    let uploaded = 0
    try {
      for (const file of files) {
        const { fullPath, thumbPath } = await store(file, product.code)
        const { error: failure } = await supabase.from('product_images').insert({
          product_id: product.id,
          variant_id: scopeVariantId,
          storage_path: fullPath,
          thumb_path: thumbPath,
          sort_order: order++,
          is_cover: false,
          alt_text: defaultAlt(scopeVariantId),
        })
        if (failure) {
          await removeFiles([fullPath, thumbPath])
          throw failure
        }
        uploaded++
      }
      notify(
        chosen.length > files.length
          ? `Subimos ${uploaded} de ${chosen.length}: el carrusel admite hasta ${MAX_CAROUSEL} fotos.`
          : uploaded === 1
            ? 'Foto subida.'
            : `${uploaded} fotos subidas.`,
        chosen.length > files.length ? 'info' : 'success',
      )
    } catch (failure) {
      notify(failure instanceof Error ? failure.message : 'No pudimos subir la foto.', 'error')
    } finally {
      setBusy(false)
      refresh()
    }
  }

  async function move(index: number, delta: -1 | 1) {
    if (!supabase) return
    const a = images[index]
    const b = images[index + delta]
    if (!a || !b) return
    const results = await Promise.all([
      supabase.from('product_images').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('product_images').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
    const failed = results.find((r) => r.error)?.error?.message
    if (failed) notify(failed, 'error')
    refresh()
  }

  async function togglePublished(image: ProductImage) {
    if (!supabase) return
    const { error: failure } = await supabase.from('product_images').update({ published: !image.published }).eq('id', image.id)
    if (failure) notify(failure.message, 'error')
    refresh()
  }

  async function remove(image: ProductImage) {
    if (!supabase) return
    if (!window.confirm('¿Quitar esta foto? Se borra el archivo y no se puede deshacer.')) return
    const { error: failure } = await supabase.from('product_images').delete().eq('id', image.id)
    if (failure) {
      notify(failure.message, 'error')
      return
    }
    await removeFiles([image.storage_path, image.thumb_path])
    notify('Foto borrada.', 'success')
    refresh()
  }

  function startEditing(image: ProductImage) {
    setEditing(image)
    setAltDraft(image.alt_text ?? '')
  }

  async function saveAlt(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !editing) return
    // An empty field goes back to the automatic text.
    const { error: failure } = await supabase
      .from('product_images')
      .update({ alt_text: altDraft.trim() || defaultAlt(editing.variant_id) })
      .eq('id', editing.id)
    if (failure) {
      notify(failure.message, 'error')
      return
    }
    notify('Texto alternativo guardado.', 'success')
    setEditing(null)
    refresh()
  }

  const sharedCount = carouselOf(null).length
  const missing = Math.max(0, MIN_CAROUSEL - images.length)
  const emptySlots = Array.from({ length: Math.max(0, MAX_CAROUSEL - images.length) }, (_, i) => images.length + i)
  const carouselChip =
    scopeVariantId === null
      ? missing > 0
        ? { className: 'chip chip-warn', text: `${images.length} de ${MAX_CAROUSEL} · faltan ${missing}` }
        : { className: 'chip chip-ok', text: `${images.length} de ${MAX_CAROUSEL}` }
      : images.length === 0
        ? { className: 'chip chip-off', text: 'Usa el carrusel general' }
        : { className: 'chip chip-ok', text: `${images.length} de ${MAX_CAROUSEL} propias` }

  return (
    <section className="space-y-5" aria-labelledby={`images-${product.id}`}>
      <h3 id={`images-${product.id}`} className="text-sm font-semibold">Imágenes</h3>

      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        {/* Cover: the main image of the design, so it gets the most room. */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-semibold">Portada</h4>
            <span className={cover ? 'chip chip-ok' : 'chip chip-warn'}>{cover ? 'Cargada' : 'Falta'}</span>
          </div>
          <input ref={coverInput} id={`cover-${product.id}`} type="file" accept="image/*" disabled={busy} onChange={(e) => void uploadCover(e)} className="sr-only" />
          {cover ? (
            <>
              <img
                src={productImageUrl(brokenCover === cover.id ? (cover.thumb_path ?? cover.storage_path) : cover.storage_path)}
                alt={altOf(cover)}
                onError={() => setBrokenCover(cover.id)}
                className="aspect-square w-64 max-w-full rounded-xl border border-line bg-white object-cover"
              />
              <div className="flex gap-2">
                <label htmlFor={`cover-${product.id}`} className="btn-quiet min-h-9 cursor-pointer px-3">Reemplazar</label>
                <IconButton icon="pencil" label="Editar texto alternativo de la portada" onClick={() => startEditing(cover)} />
                <IconButton icon="trash" label="Quitar portada" danger onClick={() => void remove(cover)} />
              </div>
              <p className="hint">Igual en todas las variantes.</p>
            </>
          ) : (
            <label
              htmlFor={`cover-${product.id}`}
              className="flex aspect-square w-64 max-w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-naranja-dark/50 bg-white text-naranja-dark hover:bg-naranja-dark/5"
            >
              <Icon name="plus" />
              <span className="text-base font-semibold">Subir portada</span>
              <span className="px-4 text-center text-xs text-muted">Igual en todas las variantes</span>
            </label>
          )}
        </div>

        {/* Carousel */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-semibold">Carrusel</h4>
              <span className={carouselChip.className}>{carouselChip.text}</span>
              {busy && <span role="status" className="hint">Subiendo…</span>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor={`carousel-${product.id}`}
                className={`btn-quiet min-h-9 cursor-pointer px-3 ${busy || images.length >= MAX_CAROUSEL ? 'pointer-events-none opacity-50' : ''}`}
              >
                {images.length >= MAX_CAROUSEL ? 'Carrusel completo' : `Subir fotos (hasta ${MAX_CAROUSEL - images.length})`}
              </label>
              <label className="text-xs text-muted" htmlFor={`scope-${product.id}`}>Ver</label>
              <select id={`scope-${product.id}`} className="input min-h-9 w-64 py-0 text-sm" value={scope} onChange={(e) => { setScope(e.target.value); setEditing(null) }}>
                <option value="">General, todas las variantes ({sharedCount})</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>{variantLabel(v)} ({carouselOf(v.id).length})</option>
                ))}
              </select>
            </div>
          </div>

          <input
            id={`carousel-${product.id}`}
            type="file"
            accept="image/*"
            multiple
            disabled={busy || images.length >= MAX_CAROUSEL}
            onChange={(e) => void uploadCarousel(e)}
            className="sr-only"
          />

          <ul className="flex flex-wrap gap-3">
            {images.map((image, index) => (
              <li key={image.id} className="w-40 space-y-2">
                <div className="relative">
                  <img
                    src={productImageUrl(image.thumb_path ?? image.storage_path)}
                    alt={altOf(image)}
                    loading="lazy"
                    className={`aspect-square w-full rounded-lg border border-line bg-white object-cover ${image.published ? '' : 'opacity-40'}`}
                  />
                  <span className="absolute left-1.5 top-1.5 inline-flex size-5 items-center justify-center rounded-full bg-tinta text-xs font-medium text-crema">{index + 1}</span>
                  {!image.published && <span className="chip chip-off absolute bottom-1.5 left-1.5">Oculta</span>}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <IconButton icon="left" label="Mover antes" disabled={index === 0} onClick={() => void move(index, -1)} />
                    <IconButton icon="right" label="Mover después" disabled={index === images.length - 1} onClick={() => void move(index, 1)} />
                  </div>
                  <div className="flex gap-1">
                    <IconButton icon="pencil" label="Editar texto alternativo" onClick={() => startEditing(image)} />
                    <IconButton icon={image.published ? 'eyeOff' : 'eye'} label={image.published ? 'Ocultar' : 'Mostrar'} onClick={() => void togglePublished(image)} />
                    <IconButton icon="trash" label="Quitar foto" danger onClick={() => void remove(image)} />
                  </div>
                </div>
              </li>
            ))}
            {emptySlots.map((slot) => {
              const required = scopeVariantId === null && slot < MIN_CAROUSEL
              return (
                <li key={`empty-${slot}`} aria-hidden className="w-40">
                  <div
                    className={`flex aspect-square w-full items-center justify-center rounded-lg border-2 border-dashed text-xs ${required ? 'border-naranja-dark/40 text-naranja-dark' : 'border-line text-muted'}`}
                  >
                    {required ? 'Requerida' : 'Opcional'}
                  </div>
                </li>
              )
            })}
          </ul>

          {scopeVariant && images.length === 0 && (
            <p className="hint">Esta variante usa el carrusel general. Si cargás fotos acá, lo reemplazan solo para ella.</p>
          )}
        </div>
      </div>

      {editing && (
        <form onSubmit={saveAlt} className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-3">
          <div className="min-w-60 flex-1">
            <label className="mb-1 block text-xs text-muted" htmlFor={`alt-${editing.id}`}>Texto alternativo (si lo dejás vacío se usa el nombre)</label>
            <input
              id={`alt-${editing.id}`}
              className="input"
              autoFocus
              value={altDraft}
              placeholder={defaultAlt(editing.variant_id)}
              onChange={(e) => setAltDraft(e.target.value)}
            />
          </div>
          <button type="submit" className="btn">Guardar</button>
          <button type="button" className="btn-quiet" onClick={() => setEditing(null)}>Cancelar</button>
        </form>
      )}
    </section>
  )
}
