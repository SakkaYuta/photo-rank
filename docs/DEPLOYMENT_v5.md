# v5.0 Deployment Guide

## Prerequisites
- Supabase CLI linked to your project: `supabase link --project-ref <PROJECT_REF>`
- Edge Functions secrets set (dashboard or CLI):
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Stripe keys for tickets/powerups via Stripe

## Apply migrations
```bash
supabase db push
```
This creates tables:
- online_assets / asset_policies / asset_approvals
- products
- battles / cheer_tickets / battle_eligibility
- storage buckets + RLS for photos-watermarked/photos-original

## Deploy functions
```bash
supabase functions deploy ingest-online-asset
supabase functions deploy generate-preview
supabase functions deploy battle-request
supabase functions deploy battle-start
supabase functions deploy battle-finish
supabase functions deploy create-cheer-ticket-intent
```

## Quick verification (curl)
Replace `YOUR_JWT` with a logged-in user JWT.

1) Ingest online asset
```bash
curl -s -X POST https://<project>.supabase.co/functions/v1/ingest-online-asset \
 -H "Authorization: Bearer YOUR_JWT" -H "Content-Type: application/json" \
 -d '{"url":"https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronalpstock_big.jpg"}'
```
Expected: `{ asset_id, status: 'approved'|'pending' }`

2) Generate preview
```bash
curl -s -X POST https://<project>.supabase.co/functions/v1/generate-preview \
 -H "Authorization: Bearer YOUR_JWT" -H "Content-Type: application/json" \
 -d '{"asset_id":"<ASSET_ID_FROM_STEP1>"}'
```
Expected: `{ preview_url, bucket: 'photos-watermarked' }`

3) Battle request
```bash
curl -s -X POST https://<project>.supabase.co/functions/v1/battle-request \
 -H "Authorization: Bearer YOUR_JWT" -H "Content-Type: application/json" \
 -d '{"opponent_id":"<USER_ID>","duration":5}'
```
Expected: `{ battle_id, status: 'scheduled' }`

4) Battle start
```bash
curl -s -X POST https://<project>.supabase.co/functions/v1/battle-start \
 -H "Authorization: Bearer YOUR_JWT" -H "Content-Type: application/json" \
 -d '{"battle_id":"<BATTLE_ID>"}'
```

5) Cheer ticket intent (Stripe)
```bash
curl -s -X POST https://<project>.supabase.co/functions/v1/create-cheer-ticket-intent \
 -H "Authorization: Bearer YOUR_JWT" -H "Content-Type: application/json" \
 -d '{"battle_id":"<BATTLE_ID>","creator_id":"<CREATOR_ID>"}'
```
Expected: `{ clientSecret }` (confirm on frontend with Stripe Elements)

6) Battle finish
```bash
curl -s -X POST https://<project>.supabase.co/functions/v1/battle-finish \
 -H "Authorization: Bearer YOUR_JWT" -H "Content-Type: application/json" \
 -d '{"battle_id":"<BATTLE_ID>","winner_id":"<WINNER_USER_ID>"}'
```

## Notes
- `asset_policies` seeded for common domains; update it for your policy.
- Storage bucket names: `photos-watermarked` (public), `photos-original` (private). Paths include user_id segment in policies.
- For production, add anti-abuse (file type/content checks on source fetch), caching, and stricter error handling.
- Stripe integration for tickets/powerups can reuse `create-payment-intent` + `stripe-webhook`.
