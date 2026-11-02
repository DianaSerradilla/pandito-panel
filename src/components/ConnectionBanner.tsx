import { useEffect, useState, useSyncExternalStore } from 'react'
import { discardPending, syncPending, usePendingTickets } from '../lib/pendingTickets.ts'
import { useToast } from './toast.ts'

const subscribe = (listener: () => void) => {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

/** Tells the team when there is no signal and sends the tickets saved meanwhile as soon as it returns. */
export function ConnectionBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine)
  const pending = usePendingTickets()
  const { notify } = useToast()
  const [sending, setSending] = useState(false)
  const waiting = pending.filter((t) => !t.error)
  const refused = pending.filter((t) => t.error)

  async function send() {
    setSending(true)
    const { sent, rejected } = await syncPending()
    setSending(false)
    if (sent > 0) notify(sent === 1 ? 'Se envió 1 ticket guardado.' : `Se enviaron ${sent} tickets guardados.`, 'success')
    if (rejected.length > 0) notify('El servidor rechazó algún ticket. Revisalo en el aviso.', 'error')
  }

  const hasWaiting = waiting.length > 0
  useEffect(() => {
    if (!online || !hasWaiting) return
    void send()
    const timer = window.setInterval(() => void send(), 20000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, hasWaiting])

  if (online && pending.length === 0) return null

  return (
    <div role="status" className="space-y-2 border-b border-line bg-crema px-4 py-3 text-sm md:px-6">
      {!online && <p className="font-semibold">Sin conexión. Podés seguir registrando: los tickets se guardan en este celular.</p>}
      {hasWaiting && (
        <p>
          {waiting.length} {waiting.length === 1 ? 'ticket guardado' : 'tickets guardados'} sin enviar.{' '}
          {online && (
            <button type="button" className="underline underline-offset-2" disabled={sending} onClick={() => void send()}>
              {sending ? 'Enviando…' : 'Enviar ahora'}
            </button>
          )}
        </p>
      )}
      {refused.map((t) => (
        <p key={t.clientId} className="text-danger">
          Un ticket de {t.units} {t.units === 1 ? 'sticker' : 'stickers'} ($ {t.total.toLocaleString('es-AR')}) fue rechazado: {t.error}{' '}
          <button type="button" className="underline underline-offset-2" onClick={() => discardPending(t.clientId)}>Descartar</button>
        </p>
      ))}
    </div>
  )
}
