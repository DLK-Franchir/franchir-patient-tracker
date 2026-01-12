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

async function resetMarcelPassword() {
  console.log('🔧 Réinitialisation du mot de passe de Marcel...\n')

  const { data, error } = await supabase.auth.admin.updateUserById(
    '432425d8-ef14-4c28-9113-0dda12c72395',
    { password: 'Marcel123!' }
  )

  if (error) {
    console.error('❌ Erreur:', error)
    return
  }

  console.log('✅ Mot de passe réinitialisé avec succès!')
  console.log('\n📧 Email: marcel.mazaltarim@gmail.com')
  console.log('🔑 Password: Marcel123!')
}

resetMarcelPassword()
