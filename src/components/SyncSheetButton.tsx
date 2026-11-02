import { useState } from 'react'
import { syncFromSheet } from '../lib/sheetSync.ts'
import { useToast } from './toast.ts'

/** Pulls designs, collections and variants from the admin spreadsheet on every click. */
export function SyncSheetButton({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const { notify } = useToast()

  async function run() {
    setBusy(true)
    try {
      const result = await syncFromSheet()
      const skipped = result.skipped.length > 0 ? ` · Omitidos: ${result.skipped.join(', ')}` : ''
      notify(`Sincronizado: ${result.productsCreated} diseños nuevos, ${result.productsUpdated} actualizados, ${result.variantsCreated} variantes nuevas${skipped}`, 'success')
      onDone()
    } catch (failure) {
      notify(failure instanceof Error ? failure.message : 'No se pudo sincronizar.', 'error')
    }
    setBusy(false)
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        className="btn-quiet"
        disabled={busy}
        onClick={() => void run()}
      >
        {busy ? 'Sincronizando…' : 'Sincronizar con la planilla'}
      </button>
    </div>
  )
}
