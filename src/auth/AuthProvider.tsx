import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase.ts'
import { AuthContext, type AuthStatus, type AuthValue } from './authContext.ts'

interface Assurance {
  userId: string
  token: string
  current: string | null
  next: string | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!supabase)
  const [staff, setStaff] = useState<{ userId: string; name: string | null } | null>(null)
  const [assurance, setAssurance] = useState<Assurance | null>(null)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null
  const token = session?.access_token ?? null

  // Being signed in is not enough: the user must have an active row in `staff`.
  useEffect(() => {
    if (!supabase || !userId) return
    let cancelled = false
    void supabase
      .from('staff')
      .select('display_name, active')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setStaff({ userId, name: data?.active ? (data.display_name as string) : null })
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  // Two-factor state of this session: refreshed whenever the token changes (after enrolling or entering a code).
  useEffect(() => {
    if (!supabase || !userId || !token) return
    let cancelled = false
    void supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (!cancelled) setAssurance({ userId, token, current: data?.currentLevel ?? null, next: data?.nextLevel ?? null })
    })
    return () => {
      cancelled = true
    }
  }, [userId, token])

  const staffChecked = staff?.userId === userId
  const staffName = staffChecked ? (staff?.name ?? null) : null
  const assuranceChecked = assurance?.userId === userId && assurance?.token === token

  const value = useMemo<AuthValue>(() => {
    let status: AuthStatus = 'loading'
    if (ready && !session) status = 'signed-out'
    else if (ready && staffChecked && !staffName) status = 'no-access'
    else if (ready && staffChecked && assuranceChecked) {
      if (assurance?.current === 'aal2') status = 'staff'
      else status = assurance?.next === 'aal2' ? 'mfa-verify' : 'mfa-enroll'
    }
    return {
      status,
      displayName: staffName,
      signIn: async (email, password) => {
        if (!supabase) return 'Falta configurar la conexión con Supabase.'
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return error ? 'No pudimos iniciar sesión. Revisá el correo y la contraseña.' : null
      },
      signOut: async () => {
        await supabase?.auth.signOut()
        setStaff(null)
        setAssurance(null)
      },
    }
  }, [ready, session, staffChecked, staffName, assuranceChecked, assurance])

  return <AuthContext value={value}>{children}</AuthContext>
}
