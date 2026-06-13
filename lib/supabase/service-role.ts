import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Client Supabase service-role (bypass RLS) — réservé aux routes
 * machine-à-machine SANS session navigateur (ex. récepteur du callback
 * « questionnaire complété » questionnaires → tracker).
 *
 * La clé service-role ne doit JAMAIS atteindre le navigateur : n'importer ce
 * module que depuis des route handlers serveur. Pas de valeur par défaut :
 * échoue (throw) si la clé est absente (fail closed).
 */
export function createServiceRoleClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service-role environment variables')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
