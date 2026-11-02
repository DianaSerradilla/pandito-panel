/** "65 × 75 mm", or null when either side is missing. Decimals use the local comma. */
export function formatMeasures(width: number | null | undefined, height: number | null | undefined): string | null {
  if (!width || !height) return null
  const side = (value: number) => value.toLocaleString('es-AR', { maximumFractionDigits: 2 })
  return `${side(width)} × ${side(height)} mm`
}
