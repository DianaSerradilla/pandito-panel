import { useEffect, useRef, useState, type DragEvent } from 'react'

interface Props {
  id: string
  label: string
  file: File | null
  onChange: (file: File | null) => void
  accept?: string
  required?: boolean
  /** Short line under the field. */
  hint?: string
}

const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

/** File field as a drop area: pick or drag a file, see its name, size and (for images) a thumbnail, change or remove it. */
export function FilePicker({ id, label, file, onChange, accept, required, hint }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [thumb, setThumb] = useState<string | null>(null)

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    // Deferred on purpose: the object URL is an external resource that has to be released when the file changes.
    void Promise.resolve().then(() => {
      if (cancelled) return
      url = file?.type.startsWith('image/') ? URL.createObjectURL(file) : null
      setThumb(url)
    })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [file])

  function clear() {
    if (input.current) input.current.value = ''
    onChange(null)
  }

  function drop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setOver(false)
    const dropped = event.dataTransfer.files[0]
    if (!dropped) return
    if (accept === 'image/*' && !dropped.type.startsWith('image/')) return
    onChange(dropped)
  }

  return (
    <div>
      <span className="label" id={`${id}-label`}>{label}</span>
      <input
        ref={input}
        id={id}
        type="file"
        accept={accept}
        required={required && !file}
        aria-labelledby={`${id}-label`}
        className="peer sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-3">
          {thumb ? (
            <img src={thumb} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
          ) : (
            <span aria-hidden className="inline-flex size-14 shrink-0 items-center justify-center rounded-lg bg-crema text-muted">
              <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
                <path d="M4 1.5h5l3 3v10H4v-13z M9 1.5v3h3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={file.name}>{file.name}</p>
            <p className="text-xs text-muted">{size(file.size)}</p>
          </div>
          <label htmlFor={id} className="btn-quiet inline-flex min-h-9 cursor-pointer items-center px-3 text-sm">Cambiar</label>
          <button type="button" className="inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-crema" aria-label={`Quitar ${file.name}`} title="Quitar" onClick={clear}>
            <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
          className={`flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-4 text-center peer-focus-visible:ring-2 peer-focus-visible:ring-azul ${
            over ? 'border-naranja-dark bg-crema' : 'border-line bg-white hover:bg-crema'
          }`}
        >
          <svg aria-hidden width="22" height="22" viewBox="0 0 16 16" fill="none" className="text-naranja-dark">
            <path d="M8 11V3M5 6l3-3 3 3M2.5 11v2h11v-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm font-medium">Elegir archivo</span>
          <span className="text-xs text-muted">o arrastralo acá</span>
        </label>
      )}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}
