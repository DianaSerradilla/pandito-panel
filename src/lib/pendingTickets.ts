import { useSyncExternalStore } from 'react'
import { supabase } from './supabase.ts'

/** Arguments of confirm_ticket, kept as they were when the ticket was registered. */
export interface TicketPayload {
  p_kind: string
  p_items: { variant_id: string; quantity: number }[]
  p_event_id: string
  p_discount: number
  p_promo_snapshot: unknown
  p_payment_method: string | null
  p_note: string | null
}

export interface PendingTicket {
  clientId: string
  eventId: string
  savedAt: string
  units: number
  total: number
  payload: TicketPayload
  /** Set when the server refused the ticket; it stays here until someone discards it. */
  error?: string
}

const KEY = 'pandito.pendingTickets'
const listeners = new Set<() => void>()
let snapshot: PendingTicket[] = read()
let syncing = false

function read(): PendingTicket[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as PendingTicket[]) : []
  } catch {
    return []
  }
}

function write(next: PendingTicket[]) {
  snapshot = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage blocked: the queue still lives in memory until the page closes.
  }
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const usePendingTickets = () => useSyncExternalStore(subscribe, () => snapshot)

/** True when the failure comes from the connection, not from the server rejecting the ticket. */
export function isConnectionError(failure: { message?: string; code?: string } | null | undefined): boolean {
  if (!failure) return false
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  return !failure.code && /failed to fetch|networkerror|network request failed|load failed|timeout|aborted/i.test(failure.message ?? '')
}

export function newClientId(): string {
  return crypto.randomUUID()
}

export function queueTicket(ticket: PendingTicket) {
  write([...snapshot.filter((t) => t.clientId !== ticket.clientId), ticket])
}

export function discardPending(clientId: string) {
  write(snapshot.filter((t) => t.clientId !== clientId))
}

export function pendingFor(eventId: string): PendingTicket[] {
  return snapshot.filter((t) => t.eventId === eventId)
}

/** Sends the queued tickets in order. The client id makes a retry safe: the server never duplicates. */
export async function syncPending(): Promise<{ sent: number; rejected: string[] }> {
  if (!supabase || syncing || snapshot.length === 0) return { sent: 0, rejected: [] }
  syncing = true
  let sent = 0
  const rejected: string[] = []
  try {
    for (const ticket of [...snapshot].filter((t) => !t.error)) {
      const { error: failure } = await supabase.rpc('confirm_ticket', { ...ticket.payload, p_client_id: ticket.clientId })
      if (isConnectionError(failure)) break
      if (failure) {
        // The server refused it (closed event, price gone…): keep it visible so the sale is never lost silently.
        rejected.push(failure.message)
        write(snapshot.map((t) => (t.clientId === ticket.clientId ? { ...t, error: failure.message } : t)))
      } else {
        sent += 1
        write(snapshot.filter((t) => t.clientId !== ticket.clientId))
      }
    }
  } finally {
    syncing = false
  }
  return { sent, rejected }
}
