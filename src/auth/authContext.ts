import { createContext, useContext } from 'react'

/** `mfa-enroll`: no authenticator app linked yet. `mfa-verify`: linked, but this session has not entered a code. */
export type AuthStatus = 'loading' | 'signed-out' | 'no-access' | 'mfa-enroll' | 'mfa-verify' | 'staff'

export interface AuthValue {
  status: AuthStatus
  displayName: string | null
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
