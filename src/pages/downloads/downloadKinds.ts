import { supabase } from '../../lib/supabase.ts'

export const KINDS = [
  { value: 'celular', label: 'Fondo de celular' },
  { value: 'computadora', label: 'Fondo de computadora' },
  { value: 'whatsapp', label: 'Sticker de WhatsApp' },
]

/** File formats offered in the form; the one that matches the chosen file is picked automatically. */
export const FORMATS = ['PNG', 'JPG', 'WEBP', 'GIF', 'SVG', 'PDF', 'ZIP', 'MP4']

/** Usual resolutions for each kind of download. An image with another size adds its own to the list. */
export const RESOLUTIONS: Record<string, string[]> = {
  celular: ['1080 × 1920', '1170 × 2532', '1284 × 2778', '1440 × 2960', '1440 × 3200'],
  computadora: ['1920 × 1080', '2560 × 1440', '2560 × 1600', '3840 × 2160'],
  whatsapp: ['512 × 512'],
}

/** A kind saved before this list existed keeps showing its raw value. */
export const kindLabel = (value: string) => KINDS.find((k) => k.value === value)?.label ?? value

export const BUCKET = 'downloads'

/** Supabase's per-file limit on the free plan. */
export const MAX_FILE_MB = 50

export const publicUrl = (path: string) => supabase?.storage.from(BUCKET).getPublicUrl(path).data.publicUrl ?? ''
