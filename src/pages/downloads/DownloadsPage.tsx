import { useState } from 'react'
import { Modal } from '../../components/Modal.tsx'
import { Pager } from '../../components/Pager.tsx'
import { SearchBox } from '../../components/SearchBox.tsx'
import { useToast } from '../../components/toast.ts'
import { usePaging } from '../../components/usePaging.ts'
import type { DownloadRow, Topic } from '../../data/types.ts'
import { useRows } from '../../data/useRows.ts'
import { supabase } from '../../lib/supabase.ts'
import { DownloadModal } from './DownloadModal.tsx'
import { BUCKET, KINDS, kindLabel, publicUrl } from './downloadKinds.ts'

interface DownloadTopic {
  download_id: string
  topic_id: string
}

/** Free downloads: a table to search, publish, edit and delete, and a dialog to add them. */
export function DownloadsPage() {
  const downloads = useRows<DownloadRow>('downloads', ['sort_order', 'title'])
  const links = useRows<DownloadTopic>('download_topics')
  const stats = useRows<{ download_id: string; total: number }>('download_stats')
  const totals = new Map(stats.rows.map((s) => [s.download_id, s.total]))
  const topics = useRows<Topic>('topics', ['sort_order', 'name'])
  const { notify } = useToast()
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState('')
  const [state, setState] = useState<'' | 'published' | 'draft' | 'incomplete'>('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<DownloadRow | null>(null)
  const [toDelete, setToDelete] = useState<DownloadRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const needle = search.trim().toLowerCase()
  const visible = downloads.rows.filter(
    (d) =>
      (!kindFilter || d.kind === kindFilter) &&
      (!state || (state === 'incomplete' ? !d.usage_terms?.trim() : (state === 'published') === d.published)) &&
      (!needle || d.title.toLowerCase().includes(needle)),
  )
  const paging = usePaging(visible)
  const topicIdsOf = (id: string) => links.rows.filter((l) => l.download_id === id).map((l) => l.topic_id)
  const reload = () => {
    downloads.reload()
    links.reload()
  }
  // A kind saved before the list existed still shows up in the filter.
  const kindOptions = [...KINDS, ...downloads.rows.filter((d) => !KINDS.some((k) => k.value === d.kind)).map((d) => ({ value: d.kind, label: d.kind }))]

  async function setPublished(item: DownloadRow, published: boolean) {
    if (!supabase) return
    if (published && !item.usage_terms?.trim()) {
      notify(`Para publicar “${item.title}”, completá las condiciones de uso en Editar.`, 'error')
      return
    }
    const { error } = await supabase.from('downloads').update({ published }).eq('id', item.id)
    if (error) {
      notify(error.message, 'error')
      return
    }
    notify(published ? `${item.title} publicada.` : `${item.title} despublicada.`, 'success')
    downloads.reload()
  }

  async function remove() {
    if (!supabase || !toDelete) return
    setDeleting(true)
    const { error } = await supabase.from('downloads').delete().eq('id', toDelete.id)
    if (error) {
      setDeleting(false)
      notify(error.message, 'error')
      return
    }
    await supabase.storage.from(BUCKET).remove([toDelete.file_path, ...(toDelete.preview_path ? [toDelete.preview_path] : [])])
    setDeleting(false)
    notify(`${toDelete.title} borrada.`, 'success')
    setToDelete(null)
    reload()
  }

  const modalProps = { topics: topics.rows, nextOrder: downloads.rows.length + 1, onSaved: reload }

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Descargas gratuitas</h1>

      <div className="flex flex-wrap items-center gap-3">
        <SearchBox id="download-search" label="Buscar descarga" placeholder="Buscar por título" value={search} onChange={(v) => { setSearch(v); paging.setPage(0) }} />
        <div className="w-52">
          <label className="sr-only" htmlFor="download-kind">Tipo</label>
          <select id="download-kind" className="input" value={kindFilter} onChange={(e) => { setKindFilter(e.target.value); paging.setPage(0) }}>
            <option value="">Todos los tipos</option>
            {kindOptions.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div className="w-44">
          <label className="sr-only" htmlFor="download-state">Estado</label>
          <select id="download-state" className="input" value={state} onChange={(e) => { setState(e.target.value as typeof state); paging.setPage(0) }}>
            <option value="">Todas</option>
            <option value="published">Publicadas</option>
            <option value="draft">Sin publicar</option>
            <option value="incomplete">Sin condiciones de uso</option>
          </select>
        </div>
        <button type="button" className="btn ml-auto" onClick={() => setAdding(true)}>Agregar descarga</button>
      </div>

      {downloads.error && <p className="error" role="alert">{downloads.error}</p>}
      {!downloads.loading && downloads.rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-line bg-white px-6 py-8 text-center">
          <p className="font-medium">Todavía no hay descargas</p>
          <p className="hint mt-1">Con “Agregar descarga” subís la primera. Nacen sin publicar.</p>
        </div>
      )}
      {downloads.rows.length > 0 && visible.length === 0 && <p className="hint">Ninguna descarga coincide con la búsqueda.</p>}
      {visible.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table>
            <thead>
              <tr>
                <th className="w-20">Vista</th>
                <th>Título</th>
                <th>Tipo</th>
                <th>Formato</th>
                <th className="text-right">Descargas</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {paging.paged.map((d) => (
                <tr key={d.id} className={d.published ? '' : 'text-muted'}>
                  <td>
                    {d.preview_path ? (
                      <img src={publicUrl(d.preview_path)} alt="" className="size-12 rounded-md object-cover" />
                    ) : (
                      <span className="inline-flex size-12 items-center justify-center rounded-md bg-crema text-xs text-muted">Sin vista</span>
                    )}
                  </td>
                  <td className="font-medium">{d.title}</td>
                  <td className="whitespace-nowrap">{kindLabel(d.kind)}</td>
                  <td className="whitespace-nowrap">
                    {d.format ?? '—'}
                    {d.resolution && <span className="block text-xs text-muted">{d.resolution}</span>}
                  </td>
                  <td className="text-right tabular-nums">{totals.get(d.id) ?? 0}</td>
                  <td className="whitespace-nowrap">
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" checked={d.published} onChange={(e) => void setPublished(d, e.target.checked)} />
                      <span className={d.published ? 'text-ok' : 'text-muted'}>{d.published ? 'Publicada' : 'Sin publicar'}</span>
                    </label>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <a href={publicUrl(d.file_path)} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-2">Abrir archivo</a>
                      <button type="button" className="btn-quiet" onClick={() => setEditing(d)}>Editar</button>
                      <button
                        type="button"
                        className="inline-flex size-11 items-center justify-center rounded-lg border border-line bg-white text-danger hover:bg-red-50"
                        aria-label={`Borrar ${d.title}`}
                        title="Borrar descarga"
                        onClick={() => setToDelete(d)}
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
      <Pager paging={paging} label="descargas" id="download-page-size" />

      <DownloadModal {...modalProps} open={adding} download={null} topicIds={[]} onClose={() => setAdding(false)} />
      <DownloadModal
        {...modalProps}
        open={editing !== null}
        download={editing}
        topicIds={editing ? topicIdsOf(editing.id) : []}
        onClose={() => setEditing(null)}
      />

      <Modal open={toDelete !== null} title="Borrar descarga" onClose={() => !deleting && setToDelete(null)}>
        {toDelete && (
          <div className="space-y-4">
            <p>Vas a borrar <strong>{toDelete.title}</strong> y su archivo. No se puede deshacer.</p>
            <p className="hint">Si solo querés sacarla de la web, cerrá esto y destildá “Publicada”: queda guardada.</p>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-quiet" disabled={deleting} onClick={() => setToDelete(null)}>Cancelar</button>
              <button type="button" className="btn" disabled={deleting} onClick={() => void remove()}>{deleting ? 'Borrando…' : 'Borrar descarga'}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
