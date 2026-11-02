import { supabase } from './supabase.ts'

export const PRODUCT_IMAGES_BUCKET = 'product-images'

/** Public URL of a file in the product images bucket (the bucket is public read). */
export function productImageUrl(path: string): string {
  return supabase?.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl ?? ''
}
