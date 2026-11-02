import type { ReactNode } from 'react'

/** Centered frame shared by the sign-in and two-step screens; same light surface and cards as the panel. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-5 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-white">
            <img src="/brand/isotipo-naranja.svg" alt="Pandito" className="h-8 w-auto" />
          </span>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold">{title}</h1>
            {subtitle && <p className="hint">{subtitle}</p>}
          </div>
        </div>
        <div className="card p-5">{children}</div>
      </div>
    </main>
  )
}
