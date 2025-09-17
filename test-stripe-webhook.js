// Test Stripe webhook Edge Function
import crypto from 'crypto'

// Load secrets from environment for local testing. Do not hardcode secrets in repo.
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://127.0.0.1:54321/functions/v1/stripe-webhook'
const SERVICE_ROLE_JWT = process.env.SERVICE_ROLE_JWT || ''

if (!WEBHOOK_SECRET) {
  console.error('Missing STRIPE_WEBHOOK_SECRET in environment. Aborting.')
  process.exit(1)
}

// Create test payload
const testPayload = {
  id: 'evt_test_webhook',
  object: 'event',
  api_version: '2020-08-27',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: 'pi_test_12345',
      object: 'payment_intent',
      amount: 2000,
      currency: 'jpy',
      status: 'succeeded',
      metadata: {
        user_id: 'user_test_123',
        work_id: 'work_test_456'
      }
    }
  },
  livemode: false,
  pending_webhooks: 1,
  request: {
    id: null,
    idempotency_key: null
  },
  type: 'payment_intent.succeeded'
}

// Create Stripe signature
function createStripeSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000)
  const payloadString = JSON.stringify(payload)
  const signedPayload = `${timestamp}.${payloadString}`

  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex')

  return {
    signature: `t=${timestamp},v1=${signature}`,
    timestamp,
    payloadString
  }
}

async function testStripeWebhook() {
  console.log('🧪 Testing Stripe webhook function...')

  try {
    const { signature, payloadString } = createStripeSignature(testPayload, WEBHOOK_SECRET)

    console.log('📤 Sending webhook request to:', WEBHOOK_URL)
    console.log('📋 Payload type:', testPayload.type)
    console.log('🔐 Signature:', signature.substring(0, 50) + '...')

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature,
        ...(SERVICE_ROLE_JWT ? { 'Authorization': `Bearer ${SERVICE_ROLE_JWT}` } : {})
      },
      body: payloadString
    })

    const responseText = await response.text()
    console.log('📊 Response status:', response.status)
    console.log('📝 Response body:', responseText)

    if (response.ok) {
      console.log('✅ Webhook function test successful!')
    } else {
      console.log('❌ Webhook function test failed')
    }

  } catch (error) {
    console.error('❌ Test error:', error.message)
  }
}

// Test partner notification function
async function testPartnerNotification() {
  console.log('\n🧪 Testing partner notification function...')

  try {
    const notificationPayload = {
      partner_id: 'f0f68597-51ea-46f0-ab9b-239208d83d71',
      notification_type: 'order_created',
      payload: {
        order_id: 'order_test_789',
        amount: 2000,
        work_id: 'work_test_456'
      },
      priority: 'high'
    }

    console.log('📤 Sending notification request...')

    const response = await fetch(process.env.NOTIFY_PARTNER_URL || 'http://127.0.0.1:54321/functions/v1/notify-partner', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SERVICE_ROLE_JWT ? { 'Authorization': `Bearer ${SERVICE_ROLE_JWT}` } : {})
      },
      body: JSON.stringify(notificationPayload)
    })

    const responseText = await response.text()
    console.log('📊 Response status:', response.status)
    console.log('📝 Response body:', responseText)

    if (response.ok) {
      console.log('✅ Partner notification test successful!')
    } else {
      console.log('❌ Partner notification test failed')
    }

  } catch (error) {
    console.error('❌ Notification test error:', error.message)
  }
}

// Run tests
async function runAllTests() {
  await testStripeWebhook()
  await testPartnerNotification()
  console.log('\n🎉 All webhook tests completed!')
}

runAllTests()
