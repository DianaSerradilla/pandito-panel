// Row shapes of the tables used by the panel. Mirrors supabase/migrations/0001_schema.sql.
// Numeric columns come back from PostgREST as numbers.

export type Fulfillment = 'on_request' | 'in_stock' | 'unavailable'

export interface Size {
  id: string
  code: string
  name: string
  width_mm: number | null
  height_mm: number | null
  active: boolean
  sort_order: number
}

export interface Material {
  id: string
  code: string
  name: string
  active: boolean
  sort_order: number
}

export interface Finish {
  id: string
  code: string
  name: string
  active: boolean
  sort_order: number
}

export interface PriceRow {
  id: string
  material_id: string
  finish_id: string
  size_id: string
  price: number
  est_unit_cost: number | null
  active: boolean
}

export interface Collection {
  id: string
  code: string
  name: string
  kind: string | null
  product_type: string
  sale_status: string
}

export interface Product {
  id: string
  code: string
  slug: string
  collection_id: string
  name: string
  description: string | null
  usage_suggestions: string | null
  width_mm: number | null
  height_mm: number | null
  published: boolean
  featured: boolean
  featured_order: number | null
  archived_at: string | null
}

export interface Variant {
  id: string
  product_id: string
  material_id: string
  finish_id: string
  size_id: string
  sku: string
  width_mm: number | null
  height_mm: number | null
  price_override: number | null
  fulfillment: Fulfillment
  published: boolean
}

export interface ProductImage {
  id: string
  product_id: string
  material_id: string | null
  /** Null = shared by every variant of the design; set = carousel image of that variant only. */
  variant_id: string | null
  view: string
  storage_path: string
  thumb_path: string | null
  alt_text: string | null
  sort_order: number
  published: boolean
  is_cover: boolean
}

export interface Promotion {
  id: string
  name: string
  kind: 'basic' | 'special'
  size_id: string | null
  material_id: string | null
  finish_id: string | null
  quantity: number
  /** Final price of the pack. Null when the promotion gives a percentage instead. */
  price: number | null
  discount_percent: number | null
  active: boolean
  starts_at: string | null
  ends_at: string | null
  sort_order: number
}

export interface DeliverySlot {
  id: string
  slot_date: string
  starts_at: string
  ends_at: string
  active: boolean
  capacity: number | null
  note: string | null
}

export type EventStatus = 'planned' | 'active' | 'closed'
export type EventKind = 'match' | 'bar' | 'fair' | 'pickup' | 'other'

export interface EventRow {
  id: string
  code: string
  name: string
  kind: EventKind
  event_date: string
  location: string | null
  status: EventStatus
  hoy_enabled: boolean
  hoy_starts_at: string | null
  hoy_ends_at: string | null
}

export interface TicketRow {
  id: string
  event_id: string | null
  kind: 'sale' | 'gift' | 'loss'
  status: 'confirmed' | 'voided'
  subtotal: number
  discount_total: number
  total: number
  payment_method: string | null
  promo_snapshot?: { promotions?: { name: string }[] } | null
  note: string | null
  created_at: string
}

export interface ReconciliationRow {
  event_id: string
  variant_id: string
  carried: number
  sold: number
  gifted: number
  returned: number
  expected_remaining: number
  counted: number | null
  difference: number | null
  note: string | null
}

export const eventKindLabels: Record<EventKind, string> = {
  match: 'Partido',
  bar: 'Bar',
  fair: 'Feria',
  pickup: 'Retiro',
  other: 'Otro',
}

export const eventStatusLabels: Record<EventStatus, string> = {
  planned: 'Planificado',
  active: 'Activo',
  closed: 'Cerrado',
}

export const paymentLabels: Record<string, string> = {
  cash: 'Efectivo',
  mercado_pago: 'Mercado Pago',
  card: 'Tarjeta',
  other: 'Otro',
}

export const fulfillmentLabels: Record<Fulfillment, string> = {
  on_request: 'A pedido',
  in_stock: 'Con stock',
  unavailable: 'No disponible',
}

export type OrderStatus = 'requested' | 'answered' | 'delivered' | 'cancelled'
export type OrderSource = 'web' | 'whatsapp' | 'event' | 'manual'

export interface OrderRow {
  id: string
  number: number
  source: OrderSource
  status: OrderStatus
  customer_name: string | null
  contact_ref: string | null
  delivery_slot_id: string | null
  event_id: string | null
  agreed_total: number | null
  discount_total: number
  notes: string | null
  cancelled_reason: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface OrderItem {
  id: string
  order_id: string
  variant_id: string
  quantity: number
  unit_price: number
}

export interface Topic {
  id: string
  slug: string
  name: string
  family: string | null
  popular: boolean
  sort_order: number
}

export interface DownloadRow {
  id: string
  slug: string
  title: string
  kind: string
  format: string | null
  resolution: string | null
  description: string | null
  usage_terms: string | null
  file_path: string
  preview_path: string | null
  published: boolean
  sort_order: number
}

export interface TopicLink {
  topic_id: string
  product_id?: string
  download_id?: string
}

export interface PrintRun {
  id: string
  code: string
  run_date: string
  supplier: string | null
  area_m2: number | null
  finish_notes: string | null
  units_received: number | null
  total_price: number | null
  status: 'ordered' | 'received'
  notes: string | null
}

export type ExpenseCategory = 'print_run' | 'supplies' | 'packaging' | 'shipping' | 'investment' | 'other'

export interface Expense {
  id: string
  occurred_at: string
  category: ExpenseCategory
  detail: string
  print_run_id: string | null
  payment_method: string | null
  amount: number
  due_date: string | null
  note: string | null
}
