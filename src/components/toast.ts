import { createContext, useContext } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastApi {
  /** Shows a short message in the top-right corner. It goes away by itself after a few seconds. */
  notify: (text: string, kind?: ToastKind) => void
}

export const ToastContext = createContext<ToastApi>({ notify: () => undefined })

export const useToast = () => useContext(ToastContext)
