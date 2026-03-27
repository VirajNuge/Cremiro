'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type AuthContextType = {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Use server-validated getUser() via our API route instead of
    // getSession() which reads from client-side storage and can be spoofed.
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then(({ user }) => {
        setUser(user ?? null)
        setLoading(false)
      })
      .catch(() => {
        setUser(null)
        setLoading(false)
      })

    // Listen for client-side auth state changes (e.g. sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Re-validate server-side on any auth state change
      if (session) {
        fetch('/api/auth/me')
          .then((res) => res.json())
          .then(({ user }) => setUser(user ?? null))
          .catch(() => setUser(null))
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
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
