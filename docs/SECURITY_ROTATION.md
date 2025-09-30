# Secrets Rotation and CORS Configuration

This guide describes how to rotate leaked keys and configure CORS for the project (Vercel front-end + Supabase Edge Functions).

## 1) Rotate Secrets

Always rotate secrets if they were committed or suspected leaked. Do NOT store secrets in the repo going forward.

### Supabase
- Reset API keys (Anon + Service Role) in Supabase project settings → API → Reset Keys.
- Update the following secrets for Edge Functions:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `SENDGRID_API_KEY` (if email is used)
  - `MFA_ENC_KEY` (32 bytes max; used by MFA function)
  - `INTERNAL_CRON_SECRET` (for internal-only functions)

For local development using the Supabase CLI:
```bash
supabase secrets set \
  SUPABASE_SERVICE_ROLE_KEY=... \
  STRIPE_SECRET_KEY=... \
  STRIPE_WEBHOOK_SECRET=... \
  SENDGRID_API_KEY=... \
  EMAIL_FROM=noreply@your-domain.com \
  MFA_ENC_KEY=your_32_byte_secret \
  INTERNAL_CRON_SECRET=some_strong_secret \
  ALLOWED_ORIGINS=https://your-app.vercel.app \
  FRONTEND_URL=https://your-app.vercel.app
```

### Vercel (Front-end)
Set project/environment variables (Production/Preview/Development as needed):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_ENVIRONMENT=production`

Do not expose server-only keys (e.g., `SUPABASE_SERVICE_ROLE_KEY`) to the browser.

## 2) Configure CORS

Edge Functions use:
- `ALLOWED_ORIGINS`: comma-separated allowlist (e.g., `https://your-app.vercel.app,https://staging.example.com`)
- `FRONTEND_URL`: fallback used by simple CORS helpers

Always set `ALLOWED_ORIGINS` in production to avoid wildcard defaults.

## 3) Validate After Rotation

1. Front-end auth and API calls succeed from allowed origins.
2. Stripe webhook delivers events and verifies signatures.
3. Email sending (if configured) succeeds.
4. Download proxy enforces MIME whitelist and returns strict security headers.

## 4) Operational Notes

- Never commit `.env` files; use the provided `.env.example` templates.
- Use provider dashboards/CLI to refresh and revoke leaked credentials.
- Consider enabling automated secret scanning (e.g., gitleaks) in CI.

