# Scheduled Functions Setup

This project provides several Edge Functions intended to run on a schedule via Supabase Scheduled Triggers.

## Functions to schedule

- battle-autostart
  - When: every 1 minute
  - Purpose: Start scheduled battles when `requested_start_at <= now` (sets `status='live'`, `start_time=now()`)
- battle-autofinish
  - When: every 1 minute
  - Purpose: Auto-finish live battles when elapsed time is over; handles tie with up to 2 overtimes
- cleanup-live-offer-reservations
  - When: every 15 minutes
  - Purpose: Remove expired `live_offer_reservations` and safely decrement `stock_reserved`
  - Header: requires `x-internal-auth: <INTERNAL_CRON_SECRET>`

## How to configure (Supabase Dashboard)

1. Open your project → Edge Functions → Scheduled Triggers → Create
2. Select function name and set Cron Expression
   - `battle-autostart`: `* * * * *`
   - `battle-autofinish`: `* * * * *`
   - `cleanup-live-offer-reservations`: `*/15 * * * *`
3. For `cleanup-live-offer-reservations`, add HTTP Header
   - Key: `x-internal-auth`
   - Value: the value you set for env `INTERNAL_CRON_SECRET`
4. Save.

## Required environment variables

- `INTERNAL_CRON_SECRET` (for cleanup-live-offer-reservations)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Edge runtime)

## Verification

- Check Execution Logs in Edge Functions after schedule runs.
- Validate battle rows transition to `live` at the requested time.
- Validate `stock_reserved` decreases and expired reservations are removed.

