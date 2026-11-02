import { useEffect, useState } from 'react'
import { readAll } from '../../lib/readAll.ts'
import { supabase } from '../../lib/supabase.ts'

export interface SaleTicket {
  id: string
  total: number
  discount_total: number
  created_at: string
  promo_snapshot: { promotions?: { id?: string; name: string; times?: number; discount?: number }[] } | null
  ticket_items: { variant_id: string; quantity: number; line_total: number }[]
}

interface Result {
  key: string
  tickets: SaleTicket[]
  error: string | null
}

/** Confirmed sales (not gifts or losses) since a date, or all of them when `since` is empty. */
export function useSalesStats(since: string) {
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    const client = supabase
    if (!client) return
    let cancelled = false
    void readAll<SaleTicket>((a, b) => {
      let query = client
        .from('tickets')
        .select('id, total, discount_total, created_at, promo_snapshot, ticket_items(variant_id, quantity, line_total)')
        .eq('status', 'confirmed')
        .eq('kind', 'sale')
        .order('created_at')
        .range(a, b)
      if (since) query = query.gte('created_at', since)
      return query
    })
      .then((tickets) => !cancelled && setResult({ key: since, tickets, error: null }))
      .catch((failure: unknown) => !cancelled && setResult({ key: since, tickets: [], error: failure instanceof Error ? failure.message : 'No se pudieron leer las ventas.' }))
    return () => {
      cancelled = true
    }
  }, [since])

  const ready = result?.key === since
  return { tickets: ready ? result.tickets : [], loading: !ready, error: ready ? result.error : null }
}
