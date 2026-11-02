import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Only the anon key belongs in the browser: every table is protected by RLS and
// only users listed in the `staff` table can read or write. Never use the
// service role key here.
export const supabase = url && anonKey ? createClient(url, anonKey) : null
