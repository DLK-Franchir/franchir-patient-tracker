import { createClient } from '@supabase/supabase-js'

let serviceRoleClient: ReturnType<typeof createClient> | null = null

function readServiceRoleEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service role environment variables')
  }

  if (serviceRoleKey === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Supabase service role key must not use the anon key')
  }

  return { supabaseUrl, serviceRoleKey }
}

export function createServiceRoleClient() {
  if (typeof window !== 'undefined') {
    throw new Error('Supabase service role client is server-only')
  }

  if (!serviceRoleClient) {
    const { supabaseUrl, serviceRoleKey } = readServiceRoleEnv()

    serviceRoleClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }

  return serviceRoleClient
}
