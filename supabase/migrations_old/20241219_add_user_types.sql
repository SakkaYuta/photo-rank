-- Add user type fields to support creator, factory, and general users
-- This migration extends the users table to support different user types

-- Add factory registration field to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_factory BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'general' CHECK (user_type IN ('general', 'creator', 'factory', 'organizer'));

-- Update existing users to have proper user_type based on is_creator
UPDATE users
SET user_type = CASE
  WHEN is_creator = true THEN 'creator'
  ELSE 'general'
END
WHERE user_type = 'general';

-- Create factory profiles table for additional factory information
CREATE TABLE IF NOT EXISTS factory_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  company_name TEXT NOT NULL,
  company_address TEXT,
  contact_person TEXT,
  business_license TEXT,
  production_capacity INTEGER,
  specialties TEXT[],
  min_order_quantity INTEGER,
  lead_time_days INTEGER,
  quality_certifications TEXT[],
  equipment_list TEXT[],
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create organizer profiles table for event organizers/curators
CREATE TABLE IF NOT EXISTS organizer_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  organization_name TEXT NOT NULL,
  organization_type TEXT, -- 'gallery', 'museum', 'event_company', 'brand', etc.
  website_url TEXT,
  social_media JSONB,
  past_events TEXT[],
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_is_factory ON users(is_factory);
CREATE INDEX IF NOT EXISTS idx_factory_profiles_user_id ON factory_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_organizer_profiles_user_id ON organizer_profiles(user_id);

-- Update trigger for factory_profiles
CREATE TRIGGER update_factory_profiles_updated_at
  BEFORE UPDATE ON factory_profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_organizer_profiles_updated_at
  BEFORE UPDATE ON organizer_profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- RLS policies for factory_profiles
ALTER TABLE factory_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Factory users can manage their own profile" ON factory_profiles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public can view verified factory profiles" ON factory_profiles
  FOR SELECT USING (verified = true);

-- RLS policies for organizer_profiles
ALTER TABLE organizer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizer users can manage their own profile" ON organizer_profiles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public can view verified organizer profiles" ON organizer_profiles
  FOR SELECT USING (verified = true);

-- Helper function to get user type
CREATE OR REPLACE FUNCTION get_user_type(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT user_type INTO result FROM users WHERE id = user_uuid;
  RETURN COALESCE(result, 'general');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is factory
CREATE OR REPLACE FUNCTION is_user_factory(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SELECT is_factory INTO result FROM users WHERE id = user_uuid;
  RETURN COALESCE(result, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;