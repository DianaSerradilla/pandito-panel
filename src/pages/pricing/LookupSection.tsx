import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal.tsx'
import { Pager } from '../../components/Pager.tsx'
import { usePaging } from '../../components/usePaging.ts'
import { SearchBox } from '../../components/SearchBox.tsx'
import { useToast } from '../../components/toast.ts'
import { useRows } from '../../data/useRows.ts'
import { supabase } from '../../lib/supabase.ts'

interface LookupRow {
  id: string
  code: string
  name: string
  active: boolean
}

interface Props {
  table: 'sizes' | 'materials' | 'finishes'
  title: string
  /** Singular, lowercase, for the "add" button and dialog. */
  noun: string
  /** What the code is used for, shown in the add dialog. */
  codeHint: string
  onChanged: () => void
}

function LookupItem({ row, table, onSaved }: { row: LookupRow; table: Props['table']; onSaved: () => void }) {
  const [name, setName] = useState(row.name)
  const [active, setActive] = useState(row.active)
  const { notify } = useToast()
  const dirty = name.trim() !== row.name || active !== row.active

  async function save() {
    if (!supabase) return
    if (!name.trim()) {
      notify('El nombre no puede quedar vacío.', 'error')
      return
    }
    const { error } = await supabase.from(table).update({ name: name.trim(), active }).eq('id', row.id)
    if (error) {
      notify(error.message, 'error')
      return
    }
    notify(`${name.trim()} guardado.`, 'success')
    onSaved()
  }

  return (
    <tr className={row.active ? '' : 'text-muted'}>
      <td className="w-16 whitespace-nowrap text-muted">{row.code}</td>
      <td>
        <label className="sr-only" htmlFor={`${table}-${row.id}-name`}>Nombre de {row.code}</label>
        <input id={`${table}-${row.id}-name`} className="input min-h-9" value={name} onChange={(e) => setName(e.target.value)} />
      </td>
      <td className="w-20 text-center">
        <label className="inline-flex min-h-9 items-center">
          <span className="sr-only">Activo: {row.code}</span>
          <input type="checkbox" className="size-4" checked={active} onChange={(e) => setActive(e.target.checked)} />
        </label>
      </td>
      <td className="w-24 text-right">
        <button type="button" className={`${dirty ? 'btn' : 'btn-quiet'} min-h-9 px-3`} disabled={!dirty} onClick={() => void save()}>Guardar</button>
      </td>
    </tr>
  )
}

/** One of the base lists (sizes, materials, finishes): edit names inline, switch them on or off, add new ones in a dialog. */
export function LookupSection({ table, title, noun, codeHint, onChanged }: Props) {
  const { rows, loading, error, reload } = useRows<LookupRow>(table, ['sort_order', 'name'])
  const [adding, setAdding] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const { notify } = useToast()
  const [search, setSearch] = useState('')
  const activeCount = rows.filter((r) => r.active).length
  const term = search.trim().toLowerCase()
  const visible = rows.filter((r) => !term || `${r.code} ${r.name}`.toLowerCase().includes(term))
  const paging = usePaging(visible, 10)

  async function add(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const { error: failure } = await supabase
      .from(table)
      .insert({ code: code.trim().toUpperCase(), name: name.trim(), sort_order: rows.length + 1 })
    if (failure) {
      notify(failure.code === '23505' ? 'Ya existe uno con ese código.' : failure.message, 'error')
      return
    }
    notify(`${name.trim()} agregado.`, 'success')
    setCode('')
    setName('')
    setAdding(false)
    reload()
    onChanged()
  }

  return (
    <section className="min-w-0 space-y-3" aria-labelledby={`${table}-title`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 id={`${table}-title`} className="text-base font-semibold">{title}</h3>
          <span className={activeCount > 0 ? 'chip chip-ok' : 'chip chip-warn'}>{activeCount} {activeCount === 1 ? 'activo' : 'activos'}</span>
        </div>
        <button type="button" className="btn-quiet min-h-9 px-3" onClick={() => setAdding(true)}>Agregar {noun}</button>
      </div>

      <SearchBox
        id={`${table}-search`}
        label={`Buscar ${noun}`}
        placeholder="Buscar por código o nombre"
        value={search}
        onChange={(value) => { setSearch(value); paging.setPage(0) }}
      />

      {loading && <p className="hint" role="status">Cargando…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {!loading && rows.length === 0 && <p className="hint">Todavía no cargaste ninguno.</p>}
      {rows.length > 0 && visible.length === 0 && <p className="hint">Ninguno coincide con la búsqueda.</p>}
      {visible.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th className="text-center">Activo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {paging.paged.map((row) => (
                <LookupItem key={`${row.id}-${row.name}-${row.active}`} row={row} table={table} onSaved={() => { reload(); onChanged() }} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager paging={paging} label={title.toLowerCase()} id={`${table}-page-size`} />

      <Modal open={adding} title={`Agregar ${noun}`} onClose={() => setAdding(false)}>
        <form onSubmit={add} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <div>
              <label className="label" htmlFor={`${table}-new-code`}>Código</label>
              <input
                id={`${table}-new-code`}
                required
                maxLength={6}
                pattern="[A-Za-z0-9]{1,6}"
                title="Letras o números, hasta 6"
                className="input uppercase"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted">{codeHint}</p>
            </div>
            <div>
              <label className="label" htmlFor={`${table}-new-name`}>Nombre</label>
              <input id={`${table}-new-name`} required className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-quiet" onClick={() => setAdding(false)}>Cancelar</button>
            <button type="submit" className="btn">Agregar {noun}</button>
          </div>
        </form>
      </Modal>
    </section>
  )
}
