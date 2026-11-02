import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.ts'

interface RowsState<T> {
  rows: T[]
  loading: boolean
  error: string | null
  reload: () => void
}

/** Reads every row of a table (or view), optionally sorted by one or more columns. */
export function useRows<T>(table: string, orderBy: string[] = []): RowsState<T> {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const orderKey = orderBy.join(',')

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    let query = supabase.from(table).select('*')
    for (const column of orderKey ? orderKey.split(',') : []) query = query.order(column)
    void query.then(({ data, error: failure }) => {
      if (cancelled) return
      setRows((data as T[] | null) ?? [])
      setError(failure ? failure.message : null)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [table, orderKey, tick])

  const reload = useCallback(() => setTick((value) => value + 1), [])
  return { rows, loading, error, reload }
}
