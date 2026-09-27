import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ""
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ""

export const hasSupabaseConfiguration = Boolean(supabaseUrl || supabaseAnonKey)
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const supabaseConfigurationError = hasSupabaseConfiguration && !supabaseConfigured

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null
