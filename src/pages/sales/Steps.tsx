const steps = ['Elegir evento', 'Registrar', 'Finalizar'] as const

/** The three stages of a market day. The current one is highlighted, earlier ones are marked done. */
export function Steps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="Pasos">
      {steps.map((label, index) => {
        const step = index + 1
        const done = step < current
        const active = step === current
        return (
          <li key={label} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span
              className={`inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold ${
                active ? 'bg-naranja-dark text-white' : done ? 'bg-ok text-white' : 'border border-line bg-white text-muted'
              }`}
            >
              {done ? '✓' : step}
            </span>
            <span className={`${active ? 'font-semibold' : 'text-muted'} ${active ? '' : 'hidden sm:inline'}`}>{label}</span>
            {step < steps.length && <span aria-hidden className="mx-1 h-px w-6 bg-line sm:w-10" />}
          </li>
        )
      })}
    </ol>
  )
}
