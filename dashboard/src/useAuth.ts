import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase, supabaseConfigured } from "./supabaseClient"

type AuthMode = "sign-in" | "sign-up"

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(supabaseConfigured)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return

    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setUser(session?.user ?? null)
      setIsLoading(false)
      setError(null)
    })

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setError(sessionError.message)
      setUser(data.session?.user ?? null)
      setIsLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function submitCredentials(email: string, password: string, mode: AuthMode) {
    if (!supabase) return
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      const result = mode === "sign-up"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password })

      if (result.error) {
        setError(result.error.message)
      } else if (mode === "sign-up" && !result.data.session) {
        setMessage("Check your email to confirm your account, then sign in.")
      }
    } catch {
      setError("Couldn't reach the authentication service. Check your connection and try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function signOut() {
    if (!supabase) return
    setIsSubmitting(true)
    setError(null)
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) setError(signOutError.message)
    setIsSubmitting(false)
  }

  return { user, isLoading, isSubmitting, error, message, submitCredentials, signOut }
}
