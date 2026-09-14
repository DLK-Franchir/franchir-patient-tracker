import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createMarcelAccount() {
  console.log('🔧 Création du compte Marcel...\n')

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'marcel@example.com',
    password: 'Marcel123!',
    email_confirm: true
  })

  if (authError) {
    console.error('❌ Erreur création compte:', authError)
    return
  }

  console.log('✅ Compte créé:', authData.user.id)

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      email: 'marcel@example.com',
      full_name: 'Marcel',
      role: 'marcel',
      // Verrou RLS (migration 20260914140000) : sans is_active, le compte ne voit rien.
      is_active: true
    })

  if (profileError) {
    console.error('❌ Erreur création profil:', profileError)
    return
  }

  console.log('✅ Profil créé avec role = marcel')
  console.log('\n📧 Email: marcel@example.com')
  console.log('🔑 Password: Marcel123!')
}

createMarcelAccount()
