import type { PillTone } from '../../components/Pill.tsx'
import type { OrderSource, OrderStatus } from '../../data/types.ts'

export const statusLabel: Record<OrderStatus, string> = {
  requested: 'Solicitado',
  answered: 'Respondido',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

export const sourceLabel: Record<OrderSource, string> = {
  web: 'Web',
  whatsapp: 'WhatsApp',
  event: 'Evento',
  manual: 'Manual',
}

/** Provisional flow (pending team approval). Moves back are allowed to fix a slip; stock is never touched. */
export const nextStatuses: Record<OrderStatus, OrderStatus[]> = {
  requested: ['answered', 'cancelled'],
  answered: ['delivered', 'requested', 'cancelled'],
  delivered: ['answered'],
  cancelled: ['requested'],
}

/** The step a request usually takes next, for the quick action in the table. */
export const advanceTo: Partial<Record<OrderStatus, OrderStatus>> = {
  requested: 'answered',
  answered: 'delivered',
}

export const orderCode = (number: number) => `R-${String(number).padStart(3, '0')}`

export const statusTone: Record<OrderStatus, PillTone> = {
  requested: 'neutral',
  answered: 'info',
  delivered: 'ok',
  cancelled: 'danger',
}
