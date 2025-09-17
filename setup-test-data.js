// Setup test data for webhook testing
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupTestData() {
  console.log('🔧 Setting up test data...')

  try {
    // Create manufacturing_partners table if needed
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS manufacturing_partners (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name TEXT NOT NULL,
          contact_email TEXT,
          webhook_url TEXT,
          webhook_secret TEXT,
          status TEXT DEFAULT 'active',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    })

    if (tableError) {
      console.log('⚠️ Table creation error (might already exist):', tableError.message)
    }

    // Insert test partner
    const { data: partner, error: partnerError } = await supabase
      .from('manufacturing_partners')
      .upsert({
        id: 'partner_test_123',
        name: 'Test Manufacturing Partner',
        contact_email: 'test@partner.com',
        webhook_url: 'https://httpbin.org/post',
        webhook_secret: 'test_secret_456',
        status: 'active'
      })
      .select()

    if (partnerError) {
      console.error('❌ Partner creation error:', partnerError.message)
    } else {
      console.log('✅ Test partner created successfully')
    }

    // Insert test users table if needed
    const { error: userTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email TEXT UNIQUE,
          display_name TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    })

    if (userTableError) {
      console.log('⚠️ Users table creation error (might already exist):', userTableError.message)
    }

    // Insert test user
    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert({
        id: 'user_test_123',
        email: 'test@example.com',
        display_name: 'Test User'
      })
      .select()

    if (userError) {
      console.error('❌ User creation error:', userError.message)
    } else {
      console.log('✅ Test user created successfully')
    }

    console.log('🎉 Test data setup completed!')

  } catch (error) {
    console.error('❌ Setup error:', error.message)
  }
}

// Run setup
setupTestData()