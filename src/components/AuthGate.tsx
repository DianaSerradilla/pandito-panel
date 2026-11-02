import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../auth/authContext.ts'
import { MfaPage } from '../auth/MfaPage.tsx'
import { supabase } from '../lib/supabase.ts'

/** Only lets staff through; everyone else is sent to the login or told they have no access. */
export function AuthGate() {
  const { status, signOut } = useAuth()

  if (!supabase) {
    return (
      <p className="error m-4" role="alert">
        Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example).
      </p>
    )
  }
  if (status === 'loading') return <p className="m-4 hint" role="status">Cargando…</p>
  if (status === 'signed-out') return <Navigate to="/ingresar" replace />
  if (status === 'no-access') {
    return (
      <div className="m-4 max-w-md space-y-3">
        <p className="error" role="alert">
          Tu cuenta no tiene acceso al panel. Pedile al equipo que te dé de alta.
        </p>
        <button type="button" className="btn-quiet" onClick={() => void signOut()}>
          Cerrar sesión
        </button>
      </div>
    )
  }
  if (status === 'mfa-enroll') return <MfaPage mode="enroll" />
  if (status === 'mfa-verify') return <MfaPage mode="verify" />
  return <Outlet />
}
