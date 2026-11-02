import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastKind } from './toast.ts'

interface ToastItem {
  id: number
  text: string
  kind: ToastKind
}

const SECONDS: Record<ToastKind, number> = { success: 4, info: 4, error: 7 }

const styles: Record<ToastKind, string> = {
  success: 'bg-ok text-white',
  info: 'bg-tinta text-white',
  error: 'bg-danger text-white',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const region_ = useRef<HTMLDivElement>(null)

  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), [])

  const notify = useCallback(
    (text: string, kind: ToastKind = 'info') => {
      const id = nextId.current++
      setItems((current) => [...current.slice(-3), { id, text, kind }])
      window.setTimeout(() => dismiss(id), SECONDS[kind] * 1000)
    },
    [dismiss],
  )

  const api = useMemo(() => ({ notify }), [notify])

  // A manual popover lives in the browser's top layer, so toasts show above an open modal. Re-showing it
  // on every change puts it back on top of anything opened after it.
  useEffect(() => {
    const region = region_.current
    if (!region) return
    if (region.matches(':popover-open')) region.hidePopover()
    if (items.length > 0) region.showPopover()
  }, [items])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        ref={region_}
        popover="manual"
        className="pointer-events-none fixed top-auto right-4 bottom-4 left-auto m-0 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 overflow-visible border-0 bg-transparent p-0"
        role="region"
        aria-label="Notificaciones"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role={item.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl p-3.5 text-sm font-medium shadow-lg ${styles[item.kind]}`}
          >
            <p className="min-w-0 flex-1">{item.text}</p>
            <button
              type="button"
              className="-m-1 flex size-7 shrink-0 items-center justify-center rounded-md text-white/80 hover:bg-white/15"
              aria-label="Cerrar notificación"
              onClick={() => dismiss(item.id)}
            >
              <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="m2 2 8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
