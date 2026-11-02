import { useSyncExternalStore } from 'react'

const query = '(min-width: 1024px)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/** True from the `lg` breakpoint up: the ticket sits beside the list instead of in a full-screen sheet. */
export function useIsDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}
