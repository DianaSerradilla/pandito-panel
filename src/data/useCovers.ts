import { useMemo } from 'react'
import type { ProductImage } from './types.ts'
import { useRows } from './useRows.ts'

/** Thumbnail of each product's cover and size of its shared carousel, keyed by product id. */
export function useCovers() {
  const images = useRows<ProductImage>('product_images')
  const { covers, carousel } = useMemo(() => {
    const covers = new Map<string, string>()
    const carousel = new Map<string, number>()
    for (const image of images.rows) {
      if (image.is_cover) covers.set(image.product_id, image.thumb_path ?? image.storage_path)
      else if (image.variant_id === null) carousel.set(image.product_id, (carousel.get(image.product_id) ?? 0) + 1)
    }
    return { covers, carousel }
  }, [images.rows])
  return { covers, carousel, reload: images.reload }
}
