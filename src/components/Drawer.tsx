import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  /** Accessible name of the panel. */
  label: string
  onClose: () => void
  children: ReactNode
}

/** A side panel on the native <dialog>: it keeps the list visible behind it, Esc and a click outside close it. */
export function Drawer({ open, label, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const openNow = useRef(open)

  useEffect(() => {
    openNow.current = open
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Same as Modal: if Esc closed the dialog but the parent kept `open`, show it again.
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
      aria-label={label}
      onClose={handleClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className="drawer my-0 ml-auto mr-0 h-dvh max-h-none w-full max-w-2xl rounded-none border-l border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-tinta/50"
    >
      {open && <div className="flex h-dvh min-h-0 flex-col">{children}</div>}
    </dialog>
  )
}
