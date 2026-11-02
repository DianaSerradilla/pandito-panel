import { extensionFor, resizeImage } from './images.ts'
import { PRODUCT_IMAGES_BUCKET } from './storage.ts'
import { supabase } from './supabase.ts'

// Web version only: the print-quality original is never uploaded (REQ-PI-CATALOG-014).
const FULL_SIDE = 1200
const THUMB_SIDE = 160

export interface StoredImage {
  fullPath: string
  thumbPath: string
}

/** Resizes one file and uploads the web version and the thumbnail; returns both storage paths. */
export async function storeProductImage(file: File, productCode: string): Promise<StoredImage> {
  if (!supabase) throw new Error('Falta configurar la conexión con Supabase.')
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} no es una imagen.`)
  const [full, thumb] = await Promise.all([resizeImage(file, FULL_SIDE, 0.85), resizeImage(file, THUMB_SIDE, 0.6)])
  const base = `${productCode}/${crypto.randomUUID()}`
  const fullPath = `${base}.${extensionFor(full)}`
  const thumbPath = `${base}-thumb.${extensionFor(thumb)}`
  const bucket = supabase.storage.from(PRODUCT_IMAGES_BUCKET)
  const up1 = await bucket.upload(fullPath, full, { contentType: full.type })
  if (up1.error) throw up1.error
  const up2 = await bucket.upload(thumbPath, thumb, { contentType: thumb.type })
  if (up2.error) {
    await bucket.remove([fullPath])
    throw up2.error
  }
  return { fullPath, thumbPath }
}

export const removeProductFiles = (paths: (string | null)[]) =>
  supabase?.storage.from(PRODUCT_IMAGES_BUCKET).remove(paths.filter((p): p is string => Boolean(p)))
