import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Script Node.js pour créer le compte Philippe Mazaltarim (mêmes droits que Marcel)
// Exécuter avec: node scripts/create-philippe-account.mjs

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function loadEnvFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const separator = trimmed.indexOf('=')
      if (separator === -1) continue
      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // .env.local optionnel si les variables sont déjà exportées
  }
}

loadEnvFile(join(__dirname, '..', '.env.local'))

const EMAIL = 'pmazaltarim@neuromtl.com'
const PASSWORD = 'Philippe123!'
const FULL_NAME = 'Philippe Mazaltarim'
const ROLE = 'marcel'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function setupPhilippeAccount() {
  console.log('🔧 Configuration du compte Philippe Mazaltarim...\n')

  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()

  if (listError) {
    console.error('❌ Erreur liste utilisateurs:', listError)
    process.exit(1)
  }

  let philippeUser = users.find((user) => user.email?.toLowerCase() === EMAIL)

  if (philippeUser) {
    console.log('✅ Utilisateur trouvé:', philippeUser.id)
    console.log('📧 Email:', philippeUser.email)

    const { error: updateError } = await supabase.auth.admin.updateUserById(philippeUser.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: FULL_NAME },
    })

    if (updateError) {
      console.error('❌ Erreur mise à jour utilisateur:', updateError)
      process.exit(1)
    }

    console.log('✅ Mot de passe et métadonnées mis à jour')
  } else {
    console.log('⚠️  Utilisateur non trouvé, création...')

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: FULL_NAME },
    })

    if (authError) {
      console.error('❌ Erreur création auth:', authError)
      process.exit(1)
    }

    philippeUser = authData.user
    console.log('✅ Utilisateur créé:', philippeUser.id)
  }

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: philippeUser.id,
    email: EMAIL,
    full_name: FULL_NAME,
    role: ROLE,
  })

  if (profileError) {
    console.error('❌ Erreur profil:', profileError)
    process.exit(1)
  }

  console.log('✅ Profil configuré avec rôle "marcel"')
  console.log('\n' + '='.repeat(50))
  console.log(`📧 Email: ${EMAIL}`)
  console.log(`🔑 Mot de passe: ${PASSWORD}`)
  console.log('🌐 URL: https://patients.franchir.eu/login')
  console.log('='.repeat(50))
}

setupPhilippeAccount()
