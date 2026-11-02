import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal.tsx'
import { useToast } from '../../components/toast.ts'
import type { DownloadRow, Topic } from '../../data/types.ts'
import { extensionFor, resizeImage } from '../../lib/images.ts'
import { slugify } from '../../lib/slug.ts'
import { supabase } from '../../lib/supabase.ts'
import { FilePicker } from '../../components/FilePicker.tsx'
import { BUCKET, FORMATS, KINDS, MAX_FILE_MB, publicUrl, RESOLUTIONS } from './downloadKinds.ts'

interface Props {
  open: boolean
  download: DownloadRow | null
  /** Topics already linked to the download (edit only). */
  topicIds: string[]
  topics: Topic[]
  nextOrder: number
  onClose: () => void
  onSaved: () => void
}

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : 'bin'
}

function DownloadForm({ download, topicIds, topics, nextOrder, onClose, onSaved }: Omit<Props, 'open'>) {
  const { notify } = useToast()
  const [title, setTitle] = useState(download?.title ?? '')
  const [kind, setKind] = useState(download?.kind ?? KINDS[0].value)
  const [format, setFormat] = useState(download?.format ?? '')
  const [resolution, setResolution] = useState(download?.resolution ?? '')
  const [description, setDescription] = useState(download?.description ?? '')
  const [terms, setTerms] = useState(download?.usage_terms ?? '')
  const [published, setPublished] = useState(download?.published ?? false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<File | null>(null)
  const [picked, setPicked] = useState(new Set(topicIds))
  const [saving, setSaving] = useState(false)

  // A kind saved before the list existed stays selectable instead of silently changing.
  const kinds = KINDS.some((k) => k.value === kind) ? KINDS : [...KINDS, { value: kind, label: kind }]
  // Same for a format that is not on the list (a file with an uncommon extension).
  const formats = !format || FORMATS.includes(format) ? FORMATS : [...FORMATS, format]
  const usual = RESOLUTIONS[kind] ?? []
  const resolutions = !resolution || usual.includes(resolution) ? usual : [...usual, resolution]

  async function chooseFile(next: File | null) {
    setFile(next)
    if (!next) return
    setFormat(extensionOf(next.name).toUpperCase())
    if (next.type.startsWith('image/')) {
      try {
        const bitmap = await createImageBitmap(next)
        setResolution(`${bitmap.width} × ${bitmap.height}`)
        bitmap.close()
      } catch {
        // Not a format the browser can read: the resolution stays as it was.
      }
    }
  }

  const toggleTopic = (id: string) =>
    setPicked((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    if (!download && !file) return notify('Elegí el archivo que se va a descargar.', 'error')
    if (file && file.size > MAX_FILE_MB * 1024 * 1024) {
      return notify(`El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${MAX_FILE_MB} MB.`, 'error')
    }
    if (published && !terms.trim()) return notify('Para publicar, completá las condiciones de uso.', 'error')
    const slug = download?.slug ?? slugify(title)
    if (!slug) return notify('Escribí un título.', 'error')

    setSaving(true)
    const bucket = supabase.storage.from(BUCKET)
    const stamp = Date.now()
    const uploaded: string[] = []
    const replaced: string[] = []
    let filePath = download?.file_path ?? ''
    let previewPath = download?.preview_path ?? null

    async function put(path: string, body: Blob | File, contentType?: string) {
      const result = await bucket.upload(path, body, { contentType: contentType || undefined })
      if (result.error) throw new Error(result.error.message)
      uploaded.push(path)
    }

    try {
      if (file) {
        const path = `${slug}/${stamp}.${extensionOf(file.name)}`
        await put(path, file, file.type)
        if (download) replaced.push(download.file_path)
        filePath = path
      }
      // The preview comes from the chosen image, or from the file itself when that is an image.
      const previewSource = preview ?? (file?.type.startsWith('image/') ? file : null)
      if (previewSource) {
        const blob = await resizeImage(previewSource, 600, 0.8)
        const path = `${slug}/${stamp}-preview.${extensionFor(blob)}`
        await put(path, blob, blob.type)
        if (download?.preview_path) replaced.push(download.preview_path)
        previewPath = path
      }
    } catch (error) {
      if (uploaded.length > 0) await bucket.remove(uploaded)
      setSaving(false)
      return notify(error instanceof Error ? error.message : 'No se pudo subir el archivo.', 'error')
    }

    const row = {
      title: title.trim(),
      kind: kind.trim(),
      format: format.trim() || null,
      resolution: resolution.trim() || null,
      description: description.trim() || null,
      usage_terms: terms.trim() || null,
      file_path: filePath,
      preview_path: previewPath,
      published,
    }
    let id = download?.id
    if (id) {
      const { error } = await supabase.from('downloads').update(row).eq('id', id)
      if (error) {
        if (uploaded.length > 0) await bucket.remove(uploaded)
        setSaving(false)
        return notify(error.message, 'error')
      }
    } else {
      const { data, error } = await supabase.from('downloads').insert({ ...row, slug, sort_order: nextOrder }).select('id').single()
      if (error || !data) {
        await bucket.remove(uploaded)
        setSaving(false)
        return notify(error?.code === '23505' ? 'Ya existe una descarga con ese título.' : (error?.message ?? 'No se pudo crear.'), 'error')
      }
      id = data.id as string
    }

    // Topics: replace the links with the ones ticked here.
    const cleared = await supabase.from('download_topics').delete().eq('download_id', id)
    const linked = cleared.error || picked.size === 0
      ? cleared
      : await supabase.from('download_topics').insert([...picked].map((topic_id) => ({ download_id: id, topic_id })))
    if (replaced.length > 0) await bucket.remove(replaced)
    setSaving(false)
    onSaved()
    if (linked.error) return notify(`La descarga se guardó, pero no sus temas: ${linked.error.message}`, 'error')
    notify(download ? 'Descarga guardada.' : 'Descarga creada.', 'success')
    onClose()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <div>
          <label className="label" htmlFor="dl-title">Título</label>
          <input id="dl-title" required className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="dl-kind">Tipo</label>
          <select id="dl-kind" required className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
            {kinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FilePicker
          id="dl-file"
          label={download ? 'Reemplazar archivo (opcional)' : 'Archivo'}
          file={file}
          required={!download}
          onChange={(next) => void chooseFile(next)}
          hint={`${download ? `Actual: ${download.file_path.split('/').pop()}. ` : ''}Se guarda en Supabase. Máximo ${MAX_FILE_MB} MB.`}
        />
        <div className="space-y-3">
          <FilePicker
            id="dl-preview"
            label="Vista previa (opcional)"
            accept="image/*"
            file={preview}
            onChange={setPreview}
            hint="Si el archivo es una imagen y no elegís otra, se usa esa misma."
          />
          {download?.preview_path && !preview && (
            <div className="flex items-center gap-3 text-xs text-muted">
              <img src={publicUrl(download.preview_path)} alt={`Vista previa actual de ${download.title}`} className="size-12 rounded-md object-cover" />
              Vista previa actual
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="dl-format">Formato</label>
          <select id="dl-format" className="input" value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="">Sin especificar</option>
            {formats.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="dl-res">Resolución</label>
          <select id="dl-res" className="input" value={resolution} onChange={(e) => setResolution(e.target.value)}>
            <option value="">Sin especificar</option>
            {resolutions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="dl-desc">Descripción</label>
        <textarea id="dl-desc" rows={2} className="input py-2" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="dl-terms">Condiciones de uso</label>
        <textarea id="dl-terms" rows={2} className="input py-2" value={terms} onChange={(e) => setTerms(e.target.value)} />
        <p className="mt-1 text-xs text-muted">Hacen falta para publicar. El equipo tiene que confirmar que el contenido se puede ofrecer gratis.</p>
      </div>

      {topics.length > 0 && (
        <fieldset>
          <legend className="label">Temas</legend>
          <div className="flex flex-wrap gap-x-5">
            {topics.map((t) => (
              <label key={t.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggleTopic(t.id)} />
                {t.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        Publicada en la web
      </label>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="btn-quiet" disabled={saving} onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn" disabled={saving}>{saving ? 'Subiendo…' : download ? 'Guardar descarga' : 'Crear descarga'}</button>
      </div>
    </form>
  )
}

/** Create or edit one free download. The form is mounted only while open, so it always starts from the download given. */
export function DownloadModal({ open, download, ...rest }: Props) {
  return (
    <Modal open={open} title={download ? 'Editar descarga' : 'Agregar descarga'} onClose={rest.onClose} wide>
      <DownloadForm download={download} {...rest} />
    </Modal>
  )
}
