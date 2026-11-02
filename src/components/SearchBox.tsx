interface Props {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}

/** Search field with the magnifier, shared by every list screen. */
export function SearchBox({ id, label, placeholder, value, onChange }: Props) {
  return (
    <div className="relative min-w-56 flex-1 sm:max-w-sm">
      <svg aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="18" height="18" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <label htmlFor={id} className="sr-only">{label}</label>
      <input id={id} type="search" className="input pl-10" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
