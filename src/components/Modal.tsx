import { useEffect, useId, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /** Wider dialog for long forms. */
  wide?: boolean
}

/** A modal on the native <dialog>: focus stays inside, Esc and a click outside close it. */
export function Modal({ open, title, onClose, children, wide }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const openNow = useRef(open)
  const titleId = useId()

  useEffect(() => {
    openNow.current = open
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Esc closes the native dialog even when the parent refuses to close (e.g. while saving):
  // if `open` is still true after the parent answered, show the dialog again so both stay in sync.
  function handleClose() {
    onClose()
    window.setTimeout(() => {
      const dialog = ref.current
      if (dialog && openNow.current && !dialog.open) dialog.showModal()
    }, 50)
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={handleClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className={`m-auto w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-tinta/50 ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
    >
      {open && (
        <div className="flex max-h-[90vh] flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
            <h2 id={titleId}className="text-lg font-semibold">{title}</h2>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-crema"
            >
              <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </header>
          <div className="overflow-y-auto overscroll-contain px-6 py-5">{children}</div>
        </div>
      )}
    </dialog>
  )
}
