import { productImageUrl } from '../lib/storage.ts'

/** Small low-quality preview. Decorative: the product name always sits next to it. */
export function Thumb({ path, size = 48 }: { path?: string | null; size?: number }) {
  const box = { width: size, height: size }
  if (!path) {
    return <span aria-hidden="true" style={box} className="inline-block shrink-0 rounded-md border border-dashed border-line bg-paper" />
  }
  return (
    <img
      src={productImageUrl(path)}
      alt=""
      loading="lazy"
      decoding="async"
      style={box}
      className="shrink-0 rounded-md border border-line bg-white object-cover"
    />
  )
}
