-- Create test data tables for webhook testing

-- Manufacturing partners table (already created in 20241217_basic_webhook_tables.sql)

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert test data safely
DO $$ BEGIN
  -- Only insert if the table and all required columns exist
  IF to_regclass('public.manufacturing_partners') IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'manufacturing_partners' AND column_name = 'webhook_url'
  ) THEN
    INSERT INTO manufacturing_partners (name, contact_email, webhook_url, webhook_secret, status)
    VALUES ('Test Manufacturing Partner', 'test@partner.com', 'https://httpbin.org/post', 'test_secret_456', 'approved')
    ON CONFLICT (name) DO NOTHING;
  END IF;
END $$;

-- Insert test user data safely
DO $$ BEGIN
  -- Only insert if the table and columns exist
  IF to_regclass('public.users') IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email'
  ) THEN
    INSERT INTO users (email, display_name)
    VALUES ('test@example.com', 'Test User')
    ON CONFLICT (email) DO NOTHING;
  END IF;
END $$;