'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type AuthUser = {
  id: string
  email?: string
  created_at?: string
  user_metadata?: {
    avatar_url?: string | null
    full_name?: string | null
  }
  // Profile fields
  username?: string | null
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
}

type AuthContextType = {
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
})

async function fetchUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' })
    if (!res.ok) return null
    const { user } = await res.json()
    return user ?? null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  // Stable ref — createClient() returns a new object every call, so storing it
  // in a ref prevents the useEffect from re-running on every render.
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current

    // Use server-validated getUser() via our API route instead of
    // getSession() which reads from client-side storage and can be spoofed.
    fetchUser().then((u) => {
      setUser(u)
      setLoading(false)
    })

    // Listen for client-side auth state changes (e.g. sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        // Re-validate server-side on any auth state change
        fetchUser().then((u) => {
          setUser(u)
          setLoading(false)
        })
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // empty deps — supabase client is stable via ref

  const signOut = async () => {
    await supabaseRef.current.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
