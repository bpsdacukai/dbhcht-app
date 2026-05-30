import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Login dengan USERNAME (bukan email) ─────────────────────
// Lookup email via RPC, lalu signIn biasa
export async function signInWithUsername(username, password) {
  // Panggil fungsi Postgres untuk dapat email dari username
  const { data: email, error: lookupErr } = await supabase
    .rpc('get_email_by_username', { p_username: username })

  if (lookupErr || !email) {
    throw new Error('Username tidak ditemukan atau tidak aktif.')
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    if (error.message.includes('Invalid login credentials'))
      throw new Error('Username atau password salah.')
    throw new Error(error.message)
  }
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', userId).single()
  if (error) throw error
  return data
}

// ── Pagu OPD ─────────────────────────────────────────────────
export async function getPaguOpd(profileId, tahun, jenis) {
  const { data } = await supabase
    .from('pagu_opd')
    .select('*')
    .eq('profile_id', profileId)
    .eq('tahun', tahun)
    .eq('jenis', jenis)
    .maybeSingle()
  return data
}
