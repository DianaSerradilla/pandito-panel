import qrcode from 'qrcode-generator'
import { useMemo, useState } from 'react'
import { useToast } from '../../components/toast.ts'

const STORAGE_KEY = 'pandito.siteUrl'
const envSite = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.trim() ?? ''

function storedSite(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

const clean = (value: string) => value.trim().replace(/\/+$/, '')

function matrixOf(text: string) {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const size = qr.getModuleCount()
  return { size, dark: (row: number, col: number) => qr.isDark(row, col) }
}

/** Draws the code on a canvas and saves it as a PNG, big enough to print. */
function downloadPng(text: string, filename: string) {
  const { size, dark } = matrixOf(text)
  const cell = 16
  const margin = 4
  const side = (size + margin * 2) * cell
  const canvas = document.createElement('canvas')
  canvas.width = side
  canvas.height = side
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, side, side)
  ctx.fillStyle = '#000'
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (dark(r, c)) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell)
    }
  }
  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = filename
  link.click()
}

/** Link and QR to the public HOY page. The page shows whichever event is active, so the code never changes. */
export function EventLink({ eventCode }: { eventCode: string }) {
  const { notify } = useToast()
  const [site, setSite] = useState(envSite || storedSite())
  const base = clean(site)
  const valid = /^https?:\/\/[^\s/]+/i.test(base)
  const url = valid ? `${base}/hoy` : ''
  const matrix = useMemo(() => (url ? matrixOf(url) : null), [url])

  function change(value: string) {
    setSite(value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Storage blocked: the address is simply asked again next time.
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      notify('Enlace copiado.', 'success')
    } catch {
      notify('No se pudo copiar. Seleccionalo y copialo a mano.', 'error')
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="ev-link-title">
      <div>
        <h3 id="ev-link-title" className="text-base font-semibold">Enlace y QR de HOY</h3>
        <p className="hint">Es el mismo para todos los eventos: la página muestra el que esté activo. Imprimilo una vez y reutilizalo.</p>
      </div>
      <div className="space-y-4 rounded-xl border border-line bg-white p-4">
        {!envSite && (
          <div>
            <label htmlFor="e-site" className="label">Dirección de la web</label>
            <input
              id="e-site"
              type="url"
              inputMode="url"
              placeholder="https://tu-dominio.com"
              className="input"
              value={site}
              onChange={(e) => change(e.target.value)}
            />
            {site && !valid && <p className="error" role="alert">Tiene que empezar con https://</p>}
          </div>
        )}
        {url && matrix && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <svg
              role="img"
              aria-label={`Código QR de ${url}`}
              viewBox={`${-4} ${-4} ${matrix.size + 8} ${matrix.size + 8}`}
              shapeRendering="crispEdges"
              className="size-40 shrink-0 rounded-lg border border-line bg-white"
            >
              <rect x={-4} y={-4} width={matrix.size + 8} height={matrix.size + 8} fill="#fff" />
              {Array.from({ length: matrix.size }, (_, r) =>
                Array.from({ length: matrix.size }, (_, c) => (matrix.dark(r, c) ? <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#000" /> : null)),
              )}
            </svg>
            <div className="min-w-0 space-y-3">
              <p className="break-all text-sm font-medium">{url}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-quiet min-h-11" onClick={() => void copy()}>Copiar enlace</button>
                <button type="button" className="btn-quiet min-h-11" onClick={() => downloadPng(url, `qr-hoy-${eventCode}.png`)}>Descargar QR</button>
              </div>
            </div>
          </div>
        )}
        {!url && <p className="hint">Cargá la dirección de la web para generar el enlace y el QR.</p>}
      </div>
    </section>
  )
}
