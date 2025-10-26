// Script to clear all target phrases from database
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function clearTargets() {
  console.log('Clearing all target phrases...')

  const { data, error } = await supabase
    .from('targets')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows

  if (error) {
    console.error('Error:', error)
  } else {
    console.log('✅ All target phrases cleared!')
  }
}

clearTargets()
