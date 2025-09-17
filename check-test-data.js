// Check test data
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkTestData() {
  console.log('🔍 Checking test data...')

  try {
    // Check partners
    const { data: partners, error: partnersError } = await supabase
      .from('manufacturing_partners')
      .select('*')

    if (partnersError) {
      console.error('❌ Partners error:', partnersError.message)
    } else {
      console.log('✅ Partners:', partners)
    }

    // Check users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')

    if (usersError) {
      console.error('❌ Users error:', usersError.message)
    } else {
      console.log('✅ Users:', users)
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

checkTestData()