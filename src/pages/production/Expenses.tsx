import { useState, type FormEvent } from 'react'
import type { Expense, ExpenseCategory, PrintRun } from '../../data/types.ts'
import { useRows } from '../../data/useRows.ts'
import { useToast } from '../../components/toast.ts'
import { supabase } from '../../lib/supabase.ts'

const money = (value: number) => `$ ${value.toLocaleString('es-AR')}`
const today = () => new Date().toLocaleDateString('sv-SE')

const categoryLabel: Record<ExpenseCategory, string> = {
  print_run: 'Tirada',
  supplies: 'Insumos',
  packaging: 'Empaque',
  shipping: 'Envíos',
  investment: 'Inversión',
  other: 'Otro',
}

const methodLabel: Record<string, string> = {
  cash: 'Efectivo',
  mercado_pago: 'Mercado Pago',
  card: 'Tarjeta',
  partner_contribution: 'Aporte de socio',
  other: 'Otro',
}

export function Expenses() {
  const expenses = useRows<Expense>('expenses')
  const runs = useRows<PrintRun>('print_runs', ['run_date'])
  const [date, setDate] = useState(today())
  const [category, setCategory] = useState<ExpenseCategory>('supplies')
  const [detail, setDetail] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('')
  const [runId, setRunId] = useState('')
  const [due, setDue] = useState('')
  const { notify } = useToast()
  const [month, setMonth] = useState(today().slice(0, 7))

  const sorted = [...expenses.rows].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
  const inMonth = sorted.filter((e) => e.occurred_at.startsWith(month))
  const monthTotal = inMonth.reduce((sum, e) => sum + e.amount, 0)

  async function add(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const value = Number(amount.replace(',', '.'))
    if (!Number.isFinite(value) || value < 0) return notify('Ingresá un monto válido.', 'error')
    if (category === 'print_run' && !runId) return notify('Elegí a qué tirada corresponde el gasto.', 'error')
    const { error: failure } = await supabase.from('expenses').insert({
      occurred_at: date,
      category,
      detail: detail.trim(),
      amount: value,
      payment_method: method || null,
      print_run_id: category === 'print_run' ? runId : null,
      due_date: due || null,
    })
    if (failure) {
      notify(failure.message, 'error')
      return
    }
    notify('Gasto registrado.', 'success')
    {
      setDetail('')
      setAmount('')
      setDue('')
      expenses.reload()
    }
  }

  async function remove(id: string) {
    if (!supabase) return
    const { error: failure } = await supabase.from('expenses').delete().eq('id', id)
    if (failure) {
      notify(failure.message, 'error')
      return
    }
    notify('Gasto borrado.', 'success')
    expenses.reload()
  }

  return (
    <section className="space-y-4" aria-labelledby="expenses-title">
      <h2 id="expenses-title" className="text-xl font-semibold">Gastos</h2>
      <form onSubmit={add} className="card space-y-3" aria-labelledby="new-expense-title">
        <h3 id="new-expense-title" className="text-lg font-semibold">Nuevo gasto</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <label className="label" htmlFor="x-date">Fecha</label>
            <input id="x-date" type="date" required className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="w-36">
            <label className="label" htmlFor="x-cat">Categoría</label>
            <select id="x-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
              {(Object.keys(categoryLabel) as ExpenseCategory[]).map((c) => <option key={c} value={c}>{categoryLabel[c]}</option>)}
            </select>
          </div>
          {category === 'print_run' && (
            <div className="w-36">
              <label className="label" htmlFor="x-run">Tirada</label>
              <select id="x-run" className="input" value={runId} onChange={(e) => setRunId(e.target.value)}>
                <option value="">Elegí una tirada</option>
                {runs.rows.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
              </select>
            </div>
          )}
          <div className="min-w-48 flex-1">
            <label className="label" htmlFor="x-detail">Detalle</label>
            <input id="x-detail" required className="input" value={detail} onChange={(e) => setDetail(e.target.value)} />
          </div>
          <div className="w-32">
            <label className="label" htmlFor="x-amount">Monto</label>
            <input id="x-amount" required inputMode="decimal" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="w-44">
            <label className="label" htmlFor="x-method">Medio de pago</label>
            <select id="x-method" className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="">Sin especificar</option>
              {Object.entries(methodLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div className="w-44">
            <label className="label" htmlFor="x-due">Vencimiento (opcional)</label>
            <input id="x-due" type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <button type="submit" className="btn">Registrar gasto</button>
        </div>
      </form>

      <div className="card">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <label className="label" htmlFor="x-month">Mes</label>
            <input id="x-month" type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <p className="font-medium">Total del mes: {money(monthTotal)}</p>
        </div>
        {expenses.error && <p className="error" role="alert">{expenses.error}</p>}
        {!expenses.loading && inMonth.length === 0 && <p className="hint">No hay gastos en este mes.</p>}
        <ul>
          {inMonth.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line py-2 first:border-t-0">
              <span className="w-24">{e.occurred_at}</span>
              <span className="w-24">{categoryLabel[e.category]}</span>
              <span className="min-w-40 flex-1">
                {e.detail}
                {e.print_run_id ? ` · ${runs.rows.find((r) => r.id === e.print_run_id)?.code ?? ''}` : ''}
              </span>
              <span className="hint">{e.payment_method ? methodLabel[e.payment_method] : ''}{e.due_date ? ` · vence ${e.due_date}` : ''}</span>
              <span className="w-28 text-right">{money(e.amount)}</span>
              <button type="button" className="btn-quiet" onClick={() => void remove(e.id)}>Quitar</button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
