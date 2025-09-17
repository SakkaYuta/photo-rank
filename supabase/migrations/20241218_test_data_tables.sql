-- Create test data tables for webhook testing

-- Manufacturing partners table
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

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert test data
INSERT INTO manufacturing_partners (name, contact_email, webhook_url, webhook_secret, status)
VALUES ('Test Manufacturing Partner', 'test@partner.com', 'https://httpbin.org/post', 'test_secret_456', 'approved')
ON CONFLICT DO NOTHING;

INSERT INTO users (email, display_name)
VALUES ('test@example.com', 'Test User')
ON CONFLICT DO NOTHING;