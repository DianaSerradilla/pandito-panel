import { useState, type FormEvent } from 'react'
import type { DeliverySlot } from '../../data/types.ts'
import { useRows } from '../../data/useRows.ts'
import { useToast } from '../../components/toast.ts'
import { supabase } from '../../lib/supabase.ts'

const today = () => new Date().toLocaleDateString('sv-SE')
const hhmm = (time: string) => time.slice(0, 5)

interface Draft {
  date: string
  from: string
  to: string
  capacity: string
  note: string
  active: boolean
}

const toRow = (draft: Draft): { row: Record<string, unknown> } | { error: string } => {
  if (draft.to <= draft.from) return { error: 'La hora de fin tiene que ser posterior a la de inicio.' }
  const capacity = draft.capacity.trim() === '' ? null : Number(draft.capacity)
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) return { error: 'El cupo tiene que ser un entero desde 1.' }
  return {
    row: {
      slot_date: draft.date,
      starts_at: draft.from,
      ends_at: draft.to,
      capacity,
      note: draft.note.trim() || null,
      active: draft.active,
    },
  }
}

function Fields({ draft, setDraft, idPrefix }: { draft: Draft; setDraft: (next: Draft) => void; idPrefix: string }) {
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft({ ...draft, [key]: value })
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-44">
        <label className="label" htmlFor={`${idPrefix}-date`}>Día</label>
        <input id={`${idPrefix}-date`} type="date" required className="input" value={draft.date} onChange={(e) => set('date', e.target.value)} />
      </div>
      <div className="w-32">
        <label className="label" htmlFor={`${idPrefix}-from`}>Desde</label>
        <input id={`${idPrefix}-from`} type="time" required className="input" value={draft.from} onChange={(e) => set('from', e.target.value)} />
      </div>
      <div className="w-32">
        <label className="label" htmlFor={`${idPrefix}-to`}>Hasta</label>
        <input id={`${idPrefix}-to`} type="time" required className="input" value={draft.to} onChange={(e) => set('to', e.target.value)} />
      </div>
      <div className="w-28">
        <label className="label" htmlFor={`${idPrefix}-cap`}>Cupo (opcional)</label>
        <input id={`${idPrefix}-cap`} type="number" min={1} className="input" value={draft.capacity} onChange={(e) => set('capacity', e.target.value)} />
      </div>
      <div className="min-w-40 flex-1">
        <label className="label" htmlFor={`${idPrefix}-note`}>Nota (opcional)</label>
        <input id={`${idPrefix}-note`} className="input" value={draft.note} onChange={(e) => set('note', e.target.value)} />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={draft.active} onChange={(e) => set('active', e.target.checked)} />
        Activa
      </label>
    </div>
  )
}

function SlotItem({ slot, onSaved }: { slot: DeliverySlot; onSaved: () => void }) {
  const [draft, setDraft] = useState<Draft>({
    date: slot.slot_date,
    from: hhmm(slot.starts_at),
    to: hhmm(slot.ends_at),
    capacity: slot.capacity?.toString() ?? '',
    note: slot.note ?? '',
    active: slot.active,
  })
  const { notify } = useToast()
  const past = slot.slot_date < today()

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const parsed = toRow(draft)
    if ('error' in parsed) {
      notify(parsed.error, 'error')
      return
    }
    const { error } = await supabase.from('delivery_slots').update(parsed.row).eq('id', slot.id)
    if (error) {
      notify(error.message, 'error')
      return
    }
    notify('Franja guardada.', 'success')
    onSaved()
  }

  return (
    <li className={`border-t border-line py-3 first:border-t-0 ${past ? 'opacity-60' : ''}`}>
      <form onSubmit={save} className="space-y-2">
        <Fields draft={draft} setDraft={setDraft} idPrefix={`slot-${slot.id}`} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-quiet">Guardar</button>
          {past && <span className="hint">Ya pasó: la web no la muestra.</span>}
        </div>
      </form>
    </li>
  )
}

export function SlotsPage() {
  const slots = useRows<DeliverySlot>('delivery_slots', ['slot_date', 'starts_at'])
  const [draft, setDraft] = useState<Draft>({ date: today(), from: '18:00', to: '19:00', capacity: '', note: '', active: true })
  const { notify } = useToast()

  async function add(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const parsed = toRow(draft)
    if ('error' in parsed) {
      notify(parsed.error, 'error')
      return
    }
    const { error: failure } = await supabase.from('delivery_slots').insert(parsed.row)
    if (failure) {
      notify(failure.message, 'error')
      return
    }
    notify('Franja creada.', 'success')
    slots.reload()
  }

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Franjas de entrega</h1>
      <p className="hint">
        La web solo muestra las franjas activas que todavía no pasaron. La coordinación final se confirma por WhatsApp.
      </p>

      <form onSubmit={add} className="card space-y-3" aria-labelledby="new-slot-title">
        <h2 id="new-slot-title" className="text-lg font-semibold">Nueva franja</h2>
        <Fields draft={draft} setDraft={setDraft} idPrefix="new-slot" />
        <button type="submit" className="btn">Crear franja</button>
      </form>

      <section className="card" aria-labelledby="slots-title">
        <h2 id="slots-title" className="mb-2 text-lg font-semibold">Franjas cargadas</h2>
        {slots.error && <p className="error" role="alert">{slots.error}</p>}
        {!slots.loading && slots.rows.length === 0 && <p className="hint">Todavía no hay franjas. Creá la primera arriba.</p>}
        <ul>
          {slots.rows.map((s) => (
            <SlotItem key={s.id + s.slot_date + s.starts_at + s.ends_at + String(s.active) + String(s.capacity)} slot={s} onSaved={slots.reload} />
          ))}
        </ul>
      </section>
    </div>
  )
}
