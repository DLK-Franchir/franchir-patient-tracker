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

async function fixMarcelProfile() {
  console.log('🔧 Vérification et correction du profil Marcel...\n')

  const marcelUserId = '432425d8-ef14-4c28-9113-0dda12c72395'

  const { data: profile, error: selectError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', marcelUserId)
    .single()

  if (selectError) {
    console.error('❌ Erreur lecture profil:', selectError)
    return
  }

  console.log('📋 Profil actuel:', profile)

  const { error: updateError } = await supabase
    .from('profiles')
    .upsert({
      id: marcelUserId,
      email: 'marcel.mazaltarim@gmail.com',
      full_name: 'Marcel (Coordinateur)',
      role: 'marcel',
      is_active: true
    }, {
      onConflict: 'id'
    })

  if (updateError) {
    console.error('❌ Erreur mise à jour:', updateError)
    return
  }

  console.log('✅ Profil mis à jour avec succès')

  const { data: updatedProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', marcelUserId)
    .single()

  console.log('📋 Profil après mise à jour:', updatedProfile)
  console.log('\n💡 Marcel doit se déconnecter et se reconnecter pour que les changements prennent effet')
}

fixMarcelProfile()
