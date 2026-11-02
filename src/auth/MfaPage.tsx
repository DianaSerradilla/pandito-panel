import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase.ts'
import { AuthShell } from './AuthShell.tsx'
import { useAuth } from './authContext.ts'

interface Enrollment {
  factorId: string
  qrCode: string
  secret: string
}

/** Second step after the password: link an authenticator app (first time) or enter the 6-digit code. */
export function MfaPage({ mode }: { mode: 'enroll' | 'verify' }) {
  const { signOut } = useAuth()
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function startEnrollment() {
    if (!supabase) return
    setBusy(true)
    setError(null)
    // A previous attempt that was never confirmed would block a new one: clear it first.
    const { data: existing } = await supabase.auth.mfa.listFactors()
    for (const factor of existing?.all ?? []) {
      if (factor.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: factor.id })
    }
    const { data, error: failure } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Panel Pandito' })
    if (failure || !data) setError('No pudimos preparar el código QR. Probá de nuevo.')
    else setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
    setBusy(false)
  }

  async function confirm(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError(null)
    let factorId = enrollment?.factorId
    if (!factorId) {
      const { data } = await supabase.auth.mfa.listFactors()
      factorId = data?.totp[0]?.id
    }
    if (!factorId) {
      setError('No encontramos tu app de autenticación vinculada.')
      setBusy(false)
      return
    }
    const { error: failure } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() })
    // On success the session upgrades and the gate lets the user in on its own.
    if (failure) setError('El código no es correcto o venció. Revisá la app y probá con el siguiente.')
    setBusy(false)
  }

  const codeForm = (
    <form onSubmit={confirm} className="space-y-3">
      <div>
        <label htmlFor="mfa-code" className="label">Código de 6 dígitos</label>
        <input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          className="input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="btn w-full" disabled={busy}>{busy ? 'Verificando…' : 'Verificar'}</button>
    </form>
  )

  return (
    <AuthShell title="Verificación en dos pasos">
      <div className="space-y-4">
        {mode === 'verify' && (
          <>
            <p className="text-sm">Abrí tu app de autenticación e ingresá el código que muestra para Panel Pandito.</p>
            {codeForm}
          </>
        )}
        {mode === 'enroll' && !enrollment && (
          <>
            <p className="text-sm">
              Para proteger el panel hace falta una app de autenticación (por ejemplo Google Authenticator, Microsoft Authenticator o
              Aegis). Se configura una sola vez.
            </p>
            {error && <p className="error" role="alert">{error}</p>}
            <button type="button" className="btn w-full" disabled={busy} onClick={() => void startEnrollment()}>
              {busy ? 'Preparando…' : 'Configurar app de autenticación'}
            </button>
          </>
        )}
        {mode === 'enroll' && enrollment && (
          <>
            <p className="text-sm">Escaneá este código QR con la app y después ingresá el código de 6 dígitos que te muestra.</p>
            <img src={enrollment.qrCode} alt="Código QR para vincular la app de autenticación" className="mx-auto h-48 w-48" />
            <p className="hint break-all">
              ¿No podés escanear? Ingresá esta clave a mano: <span className="font-mono">{enrollment.secret}</span>
            </p>
            {codeForm}
          </>
        )}
      </div>
      <button type="button" className="btn-quiet w-full" onClick={() => void signOut()}>Cerrar sesión</button>
    </AuthShell>
  )
}
