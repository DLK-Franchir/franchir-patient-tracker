import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Script Node.js pour créer le compte Gilles
// Exécuter avec: node create-gilles-account.mjs

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Clé service role (admin)

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function setupGillesAccount() {
  console.log('🔧 Configuration du compte Gilles...\n')

  // 1. Chercher l'utilisateur existant
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()

  if (listError) {
    console.error('❌ Erreur liste utilisateurs:', listError)
    return
  }

  let gillesUser = users.find(u => u.email === 'duboisgilles31@franchir.eu')

  if (gillesUser) {
    console.log('✅ Utilisateur trouvé:', gillesUser.id)
    console.log('📧 Email:', gillesUser.email)

    // Mettre à jour le mot de passe
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      gillesUser.id,
      { password: 'Gilles123!' }
    )

    if (updateError) {
      console.error('❌ Erreur mise à jour mot de passe:', updateError)
      return
    }

    console.log('✅ Mot de passe mis à jour')
  } else {
    console.log('⚠️  Utilisateur non trouvé, création...')

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'duboisgilles31@franchir.eu',
      password: 'Gilles123!',
      email_confirm: true,
      user_metadata: {
        full_name: 'Dr Gilles Dubois'
      }
    })

    if (authError) {
      console.error('❌ Erreur création auth:', authError)
      return
    }

    gillesUser = authData.user
    console.log('✅ Utilisateur créé:', gillesUser.id)
  }

  // 2. Mettre à jour le profil
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: gillesUser.id,
      email: 'duboisgilles31@franchir.eu',
      full_name: 'Dr Gilles Dubois',
      role: 'gilles'
    })

  if (profileError) {
    console.error('❌ Erreur profil:', profileError)
    return
  }

  console.log('✅ Profil configuré avec rôle "gilles"')
  console.log('\n' + '='.repeat(50))
  console.log('📧 Email: duboisgilles31@franchir.eu')
  console.log('🔑 Mot de passe: Gilles123!')
  console.log('='.repeat(50))
}

setupGillesAccount()
