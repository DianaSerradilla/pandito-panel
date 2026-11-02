import type { ReactNode } from 'react'

const tones = {
  neutral: 'bg-crema-deep text-muted',
  info: 'bg-azul/10 text-azul',
  ok: 'bg-green-100 text-ok',
  danger: 'bg-red-50 text-danger',
} as const

export type PillTone = keyof typeof tones

/** Small rounded status label. The text always says the state: color only reinforces it. */
export function Pill({ tone = 'neutral', children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
}
