import { useState } from 'react'
import { Modal } from '../../components/Modal.tsx'
import { Pager } from '../../components/Pager.tsx'
import { SearchBox } from '../../components/SearchBox.tsx'
import { useToast } from '../../components/toast.ts'
import { usePaging } from '../../components/usePaging.ts'
import type { Promotion } from '../../data/types.ts'
import { supabase } from '../../lib/supabase.ts'
import type { PromoProblem } from './PromotionsPage.tsx'
import { PromotionModal, type PromoKind, type PromoOptions } from './PromotionModal.tsx'

const money = (value: number) => `$ ${value.toLocaleString('es-AR')}`
const day = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })

interface Props {
  kind: PromoKind
  promotions: Promotion[]
  /** Designs of each special promotion, by promotion id. */
  productsOf: Map<string, string[]>
  problems: Map<string, PromoProblem>
  options: PromoOptions
  onChanged: () => void
}

/** The promotions of one kind: search, filter, switch them on or off, edit and delete. */
export function PromotionList({ kind, promotions, productsOf, problems, options, onChanged }: Props) {
  const { notify } = useToast()
  const [search, setSearch] = useState('')
  const [state, setState] = useState<'' | 'active' | 'inactive' | 'problems'>('')
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [adding, setAdding] = useState(false)
  const [toDelete, setToDelete] = useState<Promotion | null>(null)
  const [deleting, setDeleting] = useState(false)

  const nameOf = (list: { id: string; name: string }[], id: string | null, any: string) =>
    id ? (list.find((x) => x.id === id)?.name ?? '?') : any

  const own = promotions.filter((p) => p.kind === kind)
  const needle = search.trim().toLowerCase()
  const visible = own.filter(
    (p) =>
      (!state || (state === 'problems' ? problems.has(p.id) : (state === 'active') === p.active)) &&
      (!needle || p.name.toLowerCase().includes(needle)),
  )
  const paging = usePaging(visible)
  const activeCount = own.filter((p) => p.active).length

  const rule = (p: Promotion) => {
    const filters = [
      nameOf(options.sizes, p.size_id, 'cualquier tamaño'),
      nameOf(options.materials, p.material_id, 'cualquier material'),
      nameOf(options.finishes, p.finish_id, 'cualquier acabado'),
    ].join(' · ')
    if (kind === 'basic') return `${p.quantity} ${p.quantity === 1 ? 'sticker' : 'stickers'} · ${filters}`
    const total = productsOf.get(p.id)?.length ?? 0
    const group = total === p.quantity ? `Los ${total} juntos` : `${p.quantity} de ${total} diseños`
    return `${group} · ${filters}`
  }
  const discount = (p: Promotion) => (p.discount_percent !== null ? `${p.discount_percent.toLocaleString('es-AR')} % de descuento` : `${money(p.price ?? 0)} el pack`)
  const validity = (p: Promotion) =>
    p.starts_at || p.ends_at ? `${p.starts_at ? `Desde ${day(p.starts_at)}` : ''}${p.starts_at && p.ends_at ? ' ' : ''}${p.ends_at ? `hasta ${day(p.ends_at)}` : ''}` : 'Sin fechas'

  async function setActive(p: Promotion, active: boolean) {
    if (!supabase) return
    const problem = problems.get(p.id)
    if (active && problem?.blocking) {
      notify(`${p.name} no se puede activar: ${problem.text.toLowerCase()}.`, 'error')
      return
    }
    const { error } = await supabase.from('promotions').update({ active }).eq('id', p.id)
    if (error) {
      notify(error.message, 'error')
      return
    }
    notify(active ? `${p.name} activada.` : `${p.name} desactivada.`, 'success')
    onChanged()
  }

  async function remove() {
    if (!supabase || !toDelete) return
    setDeleting(true)
    const { error } = await supabase.from('promotions').delete().eq('id', toDelete.id)
    setDeleting(false)
    if (error) {
      notify(error.message, 'error')
      return
    }
    notify(`${toDelete.name} borrada.`, 'success')
    setToDelete(null)
    onChanged()
  }

  const modalProps = {
    kind,
    options,
    nextOrder: promotions.length + 1,
    onSaved: onChanged,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox id={`promo-search-${kind}`} label="Buscar promo" placeholder="Buscar por nombre" value={search} onChange={(v) => { setSearch(v); paging.setPage(0) }} />
        <div className="w-44">
          <label className="sr-only" htmlFor={`promo-state-${kind}`}>Estado</label>
          <select id={`promo-state-${kind}`} className="input" value={state} onChange={(e) => { setState(e.target.value as typeof state); paging.setPage(0) }}>
            <option value="">Todas</option>
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
            <option value="problems">Con problemas</option>
          </select>
        </div>
        <p className="hint">{activeCount} de {own.length} activas</p>
        <button type="button" className="btn ml-auto" onClick={() => setAdding(true)}>Agregar promo</button>
      </div>

      {own.length === 0 && (
        <div className="rounded-xl border border-dashed border-line bg-white px-6 py-8 text-center">
          <p className="font-medium">Todavía no hay promos {kind === 'basic' ? 'básicas' : 'especiales'}</p>
          <p className="hint mt-1">Con “Agregar promo” cargás la primera.</p>
        </div>
      )}
      {own.length > 0 && visible.length === 0 && <p className="hint">Ninguna promo coincide con la búsqueda.</p>}
      {visible.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Regla</th>
                <th>Descuento</th>
                <th>Vigencia</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {paging.paged.map((p) => (
                <tr key={p.id} className={p.active ? '' : 'text-muted'}>
                  <td>
                    <span className="font-medium">{p.name}</span>
                    {problems.get(p.id) && (
                      <span className={`chip ml-2 ${problems.get(p.id)?.blocking ? 'chip-bad' : 'chip-warn'}`}>{problems.get(p.id)?.text}</span>
                    )}
                  </td>
                  <td>{rule(p)}</td>
                  <td className="whitespace-nowrap">{discount(p)}</td>
                  <td className="whitespace-nowrap">{validity(p)}</td>
                  <td className="whitespace-nowrap">
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" checked={p.active} onChange={(e) => void setActive(p, e.target.checked)} />
                      <span className={p.active ? 'text-ok' : 'text-muted'}>{p.active ? 'Activa' : 'Inactiva'}</span>
                    </label>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" className="btn-quiet" onClick={() => setEditing(p)}>Editar</button>
                      <button
                        type="button"
                        className="inline-flex size-11 items-center justify-center rounded-lg border border-line bg-white text-danger hover:bg-red-50"
                        aria-label={`Borrar ${p.name}`}
                        title="Borrar promo"
                        onClick={() => setToDelete(p)}
                      >
                        <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.6 9h6.8L12 4M6.8 6.5v4M9.2 6.5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager paging={paging} label="promos" id={`promo-page-size-${kind}`} />

      <PromotionModal {...modalProps} open={adding} promotion={null} selectedProducts={[]} onClose={() => setAdding(false)} />
      <PromotionModal
        {...modalProps}
        open={editing !== null}
        promotion={editing}
        selectedProducts={editing ? (productsOf.get(editing.id) ?? []) : []}
        onClose={() => setEditing(null)}
      />

      <Modal open={toDelete !== null} title="Borrar promo" onClose={() => !deleting && setToDelete(null)}>
        {toDelete && (
          <div className="space-y-4">
            <p>Vas a borrar la promo <strong>{toDelete.name}</strong>. No se puede deshacer.</p>
            <p className="hint">Si solo querés frenarla, cerrá esto y destildá “Activa”: queda guardada pero no se aplica.</p>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-quiet" disabled={deleting} onClick={() => setToDelete(null)}>Cancelar</button>
              <button type="button" className="btn" disabled={deleting} onClick={() => void remove()}>{deleting ? 'Borrando…' : 'Borrar promo'}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
