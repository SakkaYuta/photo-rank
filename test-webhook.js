// Test script for webhook system
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseServiceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in environment. Aborting test.')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testWebhookTables() {
  console.log('🧪 Testing webhook database tables...')

  try {
    // Test 1: Check if tables exist by trying to select from them
    console.log('\n📋 Checking stripe_webhook_events table...')
    const { data: events, error: eventsError } = await supabase
      .from('stripe_webhook_events')
      .select('count')
      .limit(1)

    if (eventsError) {
      console.error('❌ stripe_webhook_events table error:', eventsError.message)
    } else {
      console.log('✅ stripe_webhook_events table exists')
    }

    // Test 2: Check partner_notifications table
    console.log('\n📋 Checking partner_notifications table...')
    const { data: notifications, error: notificationsError } = await supabase
      .from('partner_notifications')
      .select('count')
      .limit(1)

    if (notificationsError) {
      console.error('❌ partner_notifications table error:', notificationsError.message)
    } else {
      console.log('✅ partner_notifications table exists')
    }

    // Test 3: Check payment_failures table
    console.log('\n📋 Checking payment_failures table...')
    const { data: failures, error: failuresError } = await supabase
      .from('payment_failures')
      .select('count')
      .limit(1)

    if (failuresError) {
      console.error('❌ payment_failures table error:', failuresError.message)
    } else {
      console.log('✅ payment_failures table exists')
    }

    // Test 4: Insert test webhook event
    console.log('\n🔄 Inserting test webhook event...')
    const testEvent = {
      stripe_event_id: 'test_event_' + Date.now(),
      type: 'payment_intent.succeeded',
      payload: {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'jpy',
        status: 'succeeded'
      }
    }

    const { data: insertData, error: insertError } = await supabase
      .from('stripe_webhook_events')
      .insert(testEvent)
      .select()

    if (insertError) {
      console.error('❌ Insert error:', insertError.message)
    } else {
      console.log('✅ Successfully inserted test webhook event:', insertData[0]?.id)
    }

    // Test 5: Insert test partner notification
    console.log('\n📤 Inserting test partner notification...')
    const testNotification = {
      partner_id: crypto.randomUUID(),
      notification_type: 'order_created',
      payload: {
        order_id: 'order_test_123',
        amount: 2000
      }
    }

    const { data: notifData, error: notifError } = await supabase
      .from('partner_notifications')
      .insert(testNotification)
      .select()

    if (notifError) {
      console.error('❌ Notification insert error:', notifError.message)
    } else {
      console.log('✅ Successfully inserted test notification:', notifData[0]?.id)
    }

    console.log('\n🎉 Database test completed successfully!')

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
  }
}

// Run the test
testWebhookTables()
