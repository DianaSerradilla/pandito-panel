import { useEffect, useState } from 'react'
import { Pager } from '../../components/Pager.tsx'
import { SearchBox } from '../../components/SearchBox.tsx'
import { usePaging } from '../../components/usePaging.ts'
import { useRows } from '../../data/useRows.ts'
import { supabase } from '../../lib/supabase.ts'

interface AuditRow {
  id: number
  at: string
  actor: string | null
  table_name: string
  row_id: string | null
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  old_row: Record<string, unknown> | null
  new_row: Record<string, unknown> | null
}

interface StaffRow {
  user_id: string
  display_name: string | null
}

const LIMIT = 1000

const tableLabels: Record<string, string> = {
  price_list: 'Precio',
  promotions: 'Promoción',
  product_variants: 'Variante',
  products: 'Diseño',
  events: 'Evento',
  tickets: 'Ticket',
  delivery_slots: 'Franja de entrega',
  downloads: 'Descarga',
  orders: 'Pedido',
  event_counts: 'Conteo',
}

const actionLabels: Record<AuditRow['action'], string> = { INSERT: 'Creó', UPDATE: 'Cambió', DELETE: 'Borró' }

const when = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

/** A short, readable name for the row that changed. */
function subject(row: AuditRow): string {
  const data = row.new_row ?? row.old_row ?? {}
  const pick = (key: string) => (typeof data[key] === 'string' ? (data[key] as string) : '')
  const name = pick('name') || pick('title') || pick('code') || pick('sku') || pick('customer_name')
  return name || (row.row_id ? row.row_id.slice(0, 8) : '—')
}

/** Who did what and when, read from audit_log (REQ-PI-BASE-006). Read only. */
export function ActivityPage() {
  const staff = useRows<StaffRow>('staff')
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [table, setTable] = useState('')

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    void supabase
      .from('audit_log')
      .select('*')
      .order('at', { ascending: false })
      .limit(LIMIT)
      .then(({ data, error: failure }) => {
        if (cancelled) return
        setRows((data as AuditRow[] | null) ?? [])
        setError(failure ? failure.message : null)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const names = new Map(staff.rows.map((s) => [s.user_id, s.display_name ?? 'Equipo']))
  const who = (id: string | null) => (id ? (names.get(id) ?? 'Equipo') : 'Sistema o web')
  const needle = search.trim().toLowerCase()
  const visible = rows.filter(
    (r) =>
      (!table || r.table_name === table) &&
      (!needle || `${who(r.actor)} ${tableLabels[r.table_name] ?? r.table_name} ${subject(r)}`.toLowerCase().includes(needle)),
  )
  const paging = usePaging(visible, 25)

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Actividad</h1>
        <p className="hint">Quién hizo qué y cuándo. Solo lectura; se muestran los últimos {LIMIT} movimientos.</p>
      </header>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchBox id="activity-search" label="Buscar en la actividad" placeholder="Buscar por persona o nombre" value={search} onChange={(v) => { setSearch(v); paging.setPage(0) }} />
          <div className="w-52">
            <label htmlFor="activity-table" className="sr-only">Qué cambió</label>
            <select id="activity-table" className="input" value={table} onChange={(e) => { setTable(e.target.value); paging.setPage(0) }}>
              <option value="">Todo</option>
              {Object.entries(tableLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>

        {loading && <p className="hint" role="status">Cargando…</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {!loading && !error && visible.length === 0 && <p className="hint">No hay actividad para mostrar.</p>}

        {visible.length > 0 && (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Quién</th>
                  <th>Qué</th>
                  <th>Sobre</th>
                </tr>
              </thead>
              <tbody>
                {paging.paged.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-muted">{when(r.at)}</td>
                    <td>{who(r.actor)}</td>
                    <td>{actionLabels[r.action]} {(tableLabels[r.table_name] ?? r.table_name).toLowerCase()}</td>
                    <td className="font-medium">{subject(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager paging={paging} label="actividad" id="activity-page-size" />
      </section>
    </div>
  )
}
