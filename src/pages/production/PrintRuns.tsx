import { useState, type FormEvent } from 'react'
import type { PrintRun } from '../../data/types.ts'
import { useRows } from '../../data/useRows.ts'
import { useToast } from '../../components/toast.ts'
import { supabase } from '../../lib/supabase.ts'

const money = (value: number) => `$ ${value.toLocaleString('es-AR')}`
const num = (text: string) => (text.trim() === '' ? null : Number(text.replace(',', '.')))
const today = () => new Date().toLocaleDateString('sv-SE')

interface Draft {
  code: string
  date: string
  supplier: string
  area: string
  finish: string
  units: string
  total: string
  status: PrintRun['status']
  notes: string
}

const emptyDraft = (): Draft => ({ code: '', date: today(), supplier: '', area: '', finish: '', units: '', total: '', status: 'ordered', notes: '' })

const fromRun = (r: PrintRun): Draft => ({
  code: r.code,
  date: r.run_date,
  supplier: r.supplier ?? '',
  area: r.area_m2?.toString() ?? '',
  finish: r.finish_notes ?? '',
  units: r.units_received?.toString() ?? '',
  total: r.total_price?.toString() ?? '',
  status: r.status,
  notes: r.notes ?? '',
})

function toRow(d: Draft): { row: Record<string, unknown> } | { error: string } {
  const area = num(d.area)
  const units = num(d.units)
  const total = num(d.total)
  if (area !== null && (!Number.isFinite(area) || area < 0)) return { error: 'Ingresá una superficie válida.' }
  if (units !== null && (!Number.isInteger(units) || units < 0)) return { error: 'Las unidades recibidas tienen que ser un entero.' }
  if (total !== null && (!Number.isFinite(total) || total < 0)) return { error: 'Ingresá un precio total válido.' }
  if (d.status === 'received' && units === null) return { error: 'Para marcarla como recibida, cargá las unidades recibidas.' }
  return {
    row: {
      code: d.code.trim().toUpperCase(),
      run_date: d.date,
      supplier: d.supplier.trim() || null,
      area_m2: area,
      finish_notes: d.finish.trim() || null,
      units_received: units,
      total_price: total,
      status: d.status,
      notes: d.notes.trim() || null,
    },
  }
}

function Fields({ draft, setDraft, id }: { draft: Draft; setDraft: (d: Draft) => void; id: string }) {
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft({ ...draft, [key]: value })
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-28">
        <label className="label" htmlFor={`${id}-code`}>Código</label>
        <input id={`${id}-code`} required className="input" placeholder="GC-P1" value={draft.code} onChange={(e) => set('code', e.target.value)} />
      </div>
      <div className="w-44">
        <label className="label" htmlFor={`${id}-date`}>Fecha</label>
        <input id={`${id}-date`} type="date" required className="input" value={draft.date} onChange={(e) => set('date', e.target.value)} />
      </div>
      <div className="min-w-40 flex-1">
        <label className="label" htmlFor={`${id}-supplier`}>Proveedor</label>
        <input id={`${id}-supplier`} className="input" value={draft.supplier} onChange={(e) => set('supplier', e.target.value)} />
      </div>
      <div className="w-28">
        <label className="label" htmlFor={`${id}-area`}>Superficie m²</label>
        <input id={`${id}-area`} inputMode="decimal" className="input" value={draft.area} onChange={(e) => set('area', e.target.value)} />
      </div>
      <div className="w-28">
        <label className="label" htmlFor={`${id}-units`}>Unidades</label>
        <input id={`${id}-units`} type="number" min={0} className="input" value={draft.units} onChange={(e) => set('units', e.target.value)} />
      </div>
      <div className="w-32">
        <label className="label" htmlFor={`${id}-total`}>Precio total</label>
        <input id={`${id}-total`} inputMode="decimal" className="input" value={draft.total} onChange={(e) => set('total', e.target.value)} />
      </div>
      <div className="w-36">
        <label className="label" htmlFor={`${id}-status`}>Estado</label>
        <select id={`${id}-status`} className="input" value={draft.status} onChange={(e) => set('status', e.target.value as Draft['status'])}>
          <option value="ordered">Pedida</option>
          <option value="received">Recibida</option>
        </select>
      </div>
      <div className="min-w-48 flex-1">
        <label className="label" htmlFor={`${id}-finish`}>Notas de terminación</label>
        <input id={`${id}-finish`} className="input" value={draft.finish} onChange={(e) => set('finish', e.target.value)} />
      </div>
      <div className="min-w-48 flex-1">
        <label className="label" htmlFor={`${id}-notes`}>Notas</label>
        <input id={`${id}-notes`} className="input" value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
    </div>
  )
}

function RunItem({ run, onSaved }: { run: PrintRun; onSaved: () => void }) {
  const [draft, setDraft] = useState(fromRun(run))
  const { notify } = useToast()
  const perUnit = run.total_price !== null && run.units_received ? run.total_price / run.units_received : null

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const parsed = toRow(draft)
    if ('error' in parsed) return notify(parsed.error, 'error')
    const { error } = await supabase.from('print_runs').update(parsed.row).eq('id', run.id)
    if (error) {
      notify(error.code === '23505' ? 'Ya existe una tirada con ese código.' : error.message, 'error')
      return
    }
    notify('Tirada guardada.', 'success')
    onSaved()
  }

  return (
    <li className="border-t border-line py-3 first:border-t-0">
      <form onSubmit={save} className="space-y-2">
        <Fields draft={draft} setDraft={setDraft} id={`run-${run.id}`} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-quiet">Guardar</button>
          {perUnit !== null && <span className="hint">Costo por unidad: {money(Math.round(perUnit))}</span>}
        </div>
      </form>
    </li>
  )
}

export function PrintRuns() {
  const runs = useRows<PrintRun>('print_runs', ['run_date'])
  const [draft, setDraft] = useState(emptyDraft())
  const { notify } = useToast()

  async function add(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const parsed = toRow(draft)
    if ('error' in parsed) return notify(parsed.error, 'error')
    const { error: failure } = await supabase.from('print_runs').insert(parsed.row)
    if (failure) {
      notify(failure.code === '23505' ? 'Ya existe una tirada con ese código.' : failure.message, 'error')
      return
    }
    notify('Tirada creada.', 'success')
    {
      setDraft(emptyDraft())
      runs.reload()
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="runs-title">
      <h2 id="runs-title" className="text-xl font-semibold">Tiradas</h2>
      <p className="hint">
        Una tirada es un pedido de impresión. Al recibirla, el ingreso de unidades se registra en Stock como movimiento de ingreso.
      </p>
      <form onSubmit={add} className="card space-y-3" aria-labelledby="new-run-title">
        <h3 id="new-run-title" className="text-lg font-semibold">Nueva tirada</h3>
        <Fields draft={draft} setDraft={setDraft} id="new-run" />
        <button type="submit" className="btn">Crear tirada</button>
      </form>
      <div className="card">
        {runs.error && <p className="error" role="alert">{runs.error}</p>}
        {!runs.loading && runs.rows.length === 0 && <p className="hint">Todavía no hay tiradas. Creá la primera arriba.</p>}
        <ul>
          {runs.rows.map((r) => <RunItem key={r.id + JSON.stringify(r)} run={r} onSaved={runs.reload} />)}
        </ul>
      </div>
    </section>
  )
}
