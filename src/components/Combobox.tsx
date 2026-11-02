import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

interface Props {
  id: string
  value: string
  onChange: (value: string) => void
  /** Existing values to pick from. Typing a different one creates it. */
  options: string[]
  placeholder?: string
  /** Noun used in the "create" entry, e.g. "tema". */
  noun?: string
}

/** Text field with a styled list of existing values; anything typed that is not in the list is a new value. */
export function Combobox({ id, value, onChange, options, placeholder, noun = 'valor' }: Props) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<CSSProperties>({})
  const field = useRef<HTMLInputElement>(null)

  // The list is fixed to the viewport so a modal's own scroll never clips it or adds a second scrollbar.
  // It is measured from the input itself: the wrapper is taller for one frame, before the list is placed.
  const place = useCallback(() => {
    const rect = field.current?.getBoundingClientRect()
    if (!rect) return
    const below = window.innerHeight - rect.bottom - 12
    const above = rect.top - 12
    const useBelow = below >= 160 || below >= above
    setPosition({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(96, Math.min(224, useBelow ? below : above)),
      ...(useBelow ? { top: rect.bottom + 4 } : { bottom: window.innerHeight - rect.top + 4 }),
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, place])

  const needle = value.trim().toLowerCase()
  const matches = options.filter((option) => !needle || option.toLowerCase().includes(needle))
  const isNew = needle !== '' && !options.some((option) => option.toLowerCase() === needle)
  const listId = `${id}-list`

  // Keyboard: arrows move through the entries (existing values, then "create"), Enter picks, Esc closes.
  const [active, setActive] = useState(-1)
  const entryCount = matches.length + (isNew ? 1 : 0)
  const optionId = (index: number) => `${id}-option-${index}`
  const activeIndex = open && active >= 0 && active < entryCount ? active : -1

  function choose(index: number) {
    if (index < matches.length) onChange(matches[index])
    setOpen(false)
    setActive(-1)
  }

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <input
        ref={field}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        autoComplete="off"
        className="input pr-10"
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault()
            setOpen(false)
          } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && entryCount > 0) {
            event.preventDefault()
            setOpen(true)
            const step = event.key === 'ArrowDown' ? 1 : -1
            setActive((current) => (current < 0 ? (step === 1 ? 0 : entryCount - 1) : (current + step + entryCount) % entryCount))
          } else if (event.key === 'Enter' && activeIndex >= 0) {
            event.preventDefault()
            choose(activeIndex)
          }
        }}
      />
      <svg aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {open && (matches.length > 0 || isNew) && (
        <ul id={listId} role="listbox" style={position}
          // Pressing the list (or its scrollbar) must not blur the field, or the list would close under the pointer.
          onMouseDown={(event) => event.preventDefault()}
          className="fixed z-50 overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-lg">
          {matches.map((option, index) => (
            <li
              key={option}
              id={optionId(index)}
              role="option"
              aria-selected={option === value}
              className={`cursor-pointer px-3 py-2 text-sm hover:bg-crema ${option === value ? 'font-semibold' : ''} ${index === activeIndex ? 'bg-crema' : ''}`}
              onMouseDown={(event) => {
                event.preventDefault()
                choose(index)
              }}
            >
              {option}
            </li>
          ))}
          {isNew && (
            <li
              id={optionId(matches.length)}
              role="option"
              aria-selected={false}
              className={`cursor-pointer border-t border-line px-3 py-2 text-sm text-naranja-dark hover:bg-crema ${matches.length === activeIndex ? 'bg-crema' : ''}`}
              onMouseDown={(event) => {
                event.preventDefault()
                choose(matches.length)
              }}
            >
              Crear {noun} «{value.trim()}»
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
