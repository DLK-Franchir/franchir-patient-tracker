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

async function resetGillesPassword() {
  console.log('🔧 Réinitialisation du mot de passe de Gilles...\n')

  const gillesUserId = '50cb15a1-664b-4f44-8862-ee30bebe5169'
  const newPassword = 'Gilles123!'

  // Mettre à jour le mot de passe
  const { data, error } = await supabase.auth.admin.updateUserById(
    gillesUserId,
    { password: newPassword }
  )

  if (error) {
    console.error('❌ Erreur:', error)
    return
  }

  console.log('✅ Mot de passe mis à jour avec succès !')
  console.log('\n' + '='.repeat(60))
  console.log('📧 Email: duboisgilles31@gmail.com')
  console.log('🔑 Nouveau mot de passe: Gilles123!')
  console.log('='.repeat(60))
  console.log('\n💡 Vous pouvez maintenant vous connecter avec ces identifiants')
}

resetGillesPassword()
