-- ============================================================================
-- Photo-Rank v6.0 Schema Foundation
-- Migration: 20251002000000_v6_schema_foundation.sql
-- Description: Core user, role, and profile tables with strict normalization
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USER & AUTHENTICATION
-- ============================================================================

-- users: Core authentication and PII (minimal)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Supabase Auth integration
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Core identity
  email text UNIQUE NOT NULL,
  phone text,

  -- Verification
  is_verified boolean DEFAULT false,
  verified_at timestamptz,

  -- Account status
  is_active boolean DEFAULT true,
  suspended_at timestamptz,
  suspension_reason text,

  -- Preferences (foreign keys)
  default_address_id uuid, -- Will be set after addresses table creation
  preferred_factory_id uuid, -- Will be set after factories table creation

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz,

  -- Optimistic locking
  version integer DEFAULT 1 NOT NULL,

  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_auth ON users(auth_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_active ON users(is_active) WHERE deleted_at IS NULL;

COMMENT ON TABLE users IS 'Core user table with authentication and minimal PII';
COMMENT ON COLUMN users.auth_user_id IS 'References auth.users for Supabase Auth integration';

-- user_roles: Role-based access control
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Role types
  role text NOT NULL CHECK (role IN (
    'customer',      -- Regular buyer
    'creator',       -- Content creator
    'organizer',     -- Battle organizer
    'partner_admin', -- Manufacturing partner admin
    'admin'          -- Platform admin
  )),

  -- Role metadata
  granted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  granted_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz,

  -- Status
  is_active boolean DEFAULT true,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  revoked_at timestamptz,

  UNIQUE(user_id, role, is_active)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id, role) WHERE is_active = true;
CREATE INDEX idx_user_roles_role ON user_roles(role) WHERE is_active = true AND expires_at IS NULL OR expires_at > now();

COMMENT ON TABLE user_roles IS 'Multi-role support for users (replaces is_creator boolean)';

-- user_profiles: Public display information
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Display information
  display_name text NOT NULL,
  bio text,
  avatar_url text,

  -- Visibility settings
  profile_visibility text DEFAULT 'public' CHECK (
    profile_visibility IN ('public', 'private', 'friends_only')
  ),
  show_purchase_history boolean DEFAULT false,
  show_favorites boolean DEFAULT true,

  -- Social links
  social_links jsonb DEFAULT '{}'::jsonb,

  -- Denormalized stats (for performance)
  works_count integer DEFAULT 0 CHECK (works_count >= 0),
  followers_count integer DEFAULT 0 CHECK (followers_count >= 0),
  following_count integer DEFAULT 0 CHECK (following_count >= 0),
  total_sales_count integer DEFAULT 0 CHECK (total_sales_count >= 0),

  -- Timestamps
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_user_profiles_visibility ON user_profiles(profile_visibility);
CREATE INDEX idx_user_profiles_display_name ON user_profiles(display_name);

COMMENT ON TABLE user_profiles IS 'Public-facing user profile information (consolidated from user_public_profiles)';

-- user_settings: User preferences and settings
CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Notification preferences
  email_notifications boolean DEFAULT true,
  push_notifications boolean DEFAULT true,
  order_updates boolean DEFAULT true,
  marketing_emails boolean DEFAULT false,
  battle_invitations boolean DEFAULT true,

  -- Privacy preferences
  data_sharing_consent boolean DEFAULT false,
  analytics_opt_in boolean DEFAULT false,

  -- UI preferences
  language text DEFAULT 'ja',
  timezone text DEFAULT 'Asia/Tokyo',
  theme text DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),

  -- Additional settings (flexible)
  preferences jsonb DEFAULT '{}'::jsonb,

  -- Timestamps
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE user_settings IS 'User settings (consolidates user_notification_settings, user_privacy_settings, users.notification_settings JSONB)';

-- addresses: Unified address table
CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Address information
  label text, -- "Home", "Office", etc.
  recipient_name text NOT NULL,
  postal_code text NOT NULL,
  prefecture text NOT NULL,
  city text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  phone text NOT NULL,

  -- Flags
  is_default boolean DEFAULT false,
  is_verified boolean DEFAULT false,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz,

  CONSTRAINT valid_postal_code CHECK (postal_code ~ '^\d{3}-?\d{4}$')
);

CREATE INDEX idx_addresses_user ON addresses(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_addresses_default ON addresses(user_id, is_default) WHERE deleted_at IS NULL AND is_default = true;

-- Ensure only one default address per user
CREATE UNIQUE INDEX idx_addresses_one_default_per_user
  ON addresses(user_id)
  WHERE is_default = true AND deleted_at IS NULL;

COMMENT ON TABLE addresses IS 'Unified address table (consolidates user_addresses)';

-- Now we can set the foreign key for default_address_id
ALTER TABLE users
  ADD CONSTRAINT fk_users_default_address
  FOREIGN KEY (default_address_id) REFERENCES addresses(id) ON DELETE SET NULL;

-- organizer_profiles: Organizer-specific metadata
CREATE TABLE IF NOT EXISTS organizer_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Organizer information
  organization_name text,
  organization_type text,
  registration_number text,

  -- Contact
  business_email text,
  business_phone text,
  business_address text,

  -- Status
  approval_status text DEFAULT 'pending' CHECK (
    approval_status IN ('pending', 'approved', 'rejected', 'suspended')
  ),
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE organizer_profiles IS 'Battle organizer metadata';

-- ============================================================================
-- 2. CONTENT & CATALOG
-- ============================================================================

-- assets: Binary/URL content storage
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- File information
  file_type text NOT NULL CHECK (file_type IN ('image', 'video', 'document', 'audio')),
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes > 0),

  -- Storage
  storage_provider text DEFAULT 'supabase_storage' NOT NULL,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,

  -- Metadata
  original_filename text,
  width integer CHECK (width > 0),
  height integer CHECK (height > 0),
  duration_seconds integer CHECK (duration_seconds > 0),

  -- Deduplication
  content_hash text UNIQUE NOT NULL,

  -- Source (for URL-based ingestion)
  source_url text,
  provider text, -- 'pixabay', 'unsplash', 'user_upload', etc.

  -- Security
  is_public boolean DEFAULT false,
  virus_scan_status text DEFAULT 'pending' CHECK (
    virus_scan_status IN ('pending', 'clean', 'infected', 'error', 'skipped')
  ),

  -- Usage tracking (denormalized)
  usage_count integer DEFAULT 0 CHECK (usage_count >= 0),

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz,

  UNIQUE(storage_bucket, storage_path)
);

CREATE INDEX idx_assets_owner ON assets(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assets_hash ON assets(content_hash) WHERE deleted_at IS NULL;
CREATE INDEX idx_assets_type ON assets(file_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_assets_provider ON assets(provider) WHERE deleted_at IS NULL;

COMMENT ON TABLE assets IS 'Unified media asset storage (consolidates online_assets)';

-- asset_ingestions: URL ingestion metadata
CREATE TABLE IF NOT EXISTS asset_ingestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid UNIQUE NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Ingestion details
  source_url text NOT NULL,
  provider text,

  -- Policy
  policy text DEFAULT 'manual' CHECK (policy IN ('allow', 'deny', 'manual')),
  status text DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'blocked')
  ),

  -- Approval
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,

  -- Metadata
  title text,
  author text,
  license_info jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT unique_content_hash UNIQUE (owner_user_id, source_url)
);

CREATE INDEX idx_asset_ingestions_owner ON asset_ingestions(owner_user_id);
CREATE INDEX idx_asset_ingestions_provider_status ON asset_ingestions(provider, status);

COMMENT ON TABLE asset_ingestions IS 'URL-based asset ingestion tracking (replaces online_assets ingestion logic)';

-- categories: Hierarchical categorization
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES categories(id) ON DELETE CASCADE,

  -- Category information
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,

  -- Hierarchy
  level integer DEFAULT 0 CHECK (level >= 0),
  path text, -- Materialized path: '/landscape/nature/mountains'

  -- Display
  icon text,
  color text,
  sort_order integer DEFAULT 0,

  -- Status
  is_active boolean DEFAULT true,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX idx_categories_parent ON categories(parent_id) WHERE is_active = true;
CREATE INDEX idx_categories_path ON categories(path) WHERE is_active = true;
CREATE INDEX idx_categories_slug ON categories(slug) WHERE is_active = true;

COMMENT ON TABLE categories IS 'Hierarchical category tree (replaces works.category text)';

-- tags: Normalized tags
CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,

  -- Usage tracking
  usage_count integer DEFAULT 0 CHECK (usage_count >= 0),

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT valid_tag_slug CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX idx_tags_usage ON tags(usage_count DESC);
CREATE INDEX idx_tags_name ON tags(name);

COMMENT ON TABLE tags IS 'Normalized tags (replaces works.tags text[])';

-- works: Art work master
CREATE TABLE IF NOT EXISTS works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Basic information
  title text NOT NULL,
  description text,

  -- Categorization
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,

  -- Primary asset
  primary_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  preview_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,

  -- Content metadata
  capture_date date,
  camera_info jsonb,
  location_info jsonb,

  -- Rights information
  copyright_info text,
  license_type text DEFAULT 'all_rights_reserved',
  usage_terms text,

  -- Sales configuration (backward compatibility)
  is_for_sale boolean DEFAULT false,
  base_price integer CHECK (base_price >= 0),

  -- Status
  status text DEFAULT 'draft' CHECK (
    status IN ('draft', 'published', 'archived', 'removed')
  ),
  moderation_status text DEFAULT 'pending' CHECK (
    moderation_status IN ('pending', 'approved', 'rejected')
  ),

  -- Statistics (denormalized)
  view_count integer DEFAULT 0 CHECK (view_count >= 0),
  favorite_count integer DEFAULT 0 CHECK (favorite_count >= 0),

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  published_at timestamptz,
  deleted_at timestamptz,

  -- Optimistic locking
  version integer DEFAULT 1 NOT NULL
);

CREATE INDEX idx_works_creator ON works(creator_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_works_status ON works(status, published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_works_category ON works(category_id) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX idx_works_for_sale ON works(is_for_sale) WHERE status = 'published' AND deleted_at IS NULL;

COMMENT ON TABLE works IS 'Art work master (separates content from products)';

-- work_assets: Work to multiple assets relationship
CREATE TABLE IF NOT EXISTS work_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,

  -- Usage purpose
  usage_type text DEFAULT 'gallery' CHECK (
    usage_type IN ('primary', 'preview', 'gallery', 'variant', 'attachment')
  ),

  -- Ordering
  sort_order integer DEFAULT 0,

  -- Metadata
  caption text,
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,

  UNIQUE(work_id, asset_id, usage_type)
);

CREATE INDEX idx_work_assets_work ON work_assets(work_id, sort_order);
CREATE INDEX idx_work_assets_asset ON work_assets(asset_id);

COMMENT ON TABLE work_assets IS 'Work to multiple assets mapping (replaces single image_url)';

-- work_tags: Work to tag relationship
CREATE TABLE IF NOT EXISTS work_tags (
  work_id uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,

  created_at timestamptz DEFAULT now() NOT NULL,

  PRIMARY KEY (work_id, tag_id)
);

CREATE INDEX idx_work_tags_tag ON work_tags(tag_id);

COMMENT ON TABLE work_tags IS 'Work to tag many-to-many relationship (replaces works.tags text[])';

-- ============================================================================
-- 3. TRIGGERS & FUNCTIONS
-- ============================================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_addresses_updated_at ON addresses;
CREATE TRIGGER trigger_addresses_updated_at
  BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trigger_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_user_settings_updated_at ON user_settings;
CREATE TRIGGER trigger_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_organizer_profiles_updated_at ON organizer_profiles;
CREATE TRIGGER trigger_organizer_profiles_updated_at
  BEFORE UPDATE ON organizer_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_categories_updated_at ON categories;
CREATE TRIGGER trigger_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_works_updated_at ON works;
CREATE TRIGGER trigger_works_updated_at
  BEFORE UPDATE ON works
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_asset_ingestions_updated_at ON asset_ingestions;
CREATE TRIGGER trigger_asset_ingestions_updated_at
  BEFORE UPDATE ON asset_ingestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function: Sync auth.users with users table
CREATE OR REPLACE FUNCTION sync_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO users (auth_user_id, email, created_at)
    VALUES (NEW.id, NEW.email, NEW.created_at)
    ON CONFLICT (auth_user_id) DO NOTHING;

    -- Create default profile
    INSERT INTO user_profiles (user_id, display_name)
    VALUES (
      (SELECT id FROM users WHERE auth_user_id = NEW.id),
      COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- Create default settings
    INSERT INTO user_settings (user_id)
    VALUES ((SELECT id FROM users WHERE auth_user_id = NEW.id))
    ON CONFLICT (user_id) DO NOTHING;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE users
    SET email = NEW.email,
        updated_at = now()
    WHERE auth_user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply auth sync trigger
DROP TRIGGER IF EXISTS trigger_sync_auth_user ON auth.users;
CREATE TRIGGER trigger_sync_auth_user
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_auth_user();

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_ingestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE works ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_tags ENABLE ROW LEVEL SECURITY;

-- Users: Can view own record
DROP POLICY IF EXISTS users_select_own ON users;
CREATE POLICY users_select_own ON users
  FOR SELECT USING (auth.uid() = auth_user_id OR auth.uid() IN (
    SELECT user_id FROM user_roles WHERE role = 'admin' AND is_active = true
  ));

DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_update_own ON users
  FOR UPDATE USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- User Profiles: Public or own
DROP POLICY IF EXISTS user_profiles_select ON user_profiles;
CREATE POLICY user_profiles_select ON user_profiles
  FOR SELECT USING (
    profile_visibility = 'public' OR
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS user_profiles_update_own ON user_profiles;
CREATE POLICY user_profiles_update_own ON user_profiles
  FOR UPDATE USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- User Settings: Own only
DROP POLICY IF EXISTS user_settings_own ON user_settings;
CREATE POLICY user_settings_own ON user_settings
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Addresses: Own only
DROP POLICY IF EXISTS addresses_own ON addresses;
CREATE POLICY addresses_own ON addresses
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Assets: Owner or public
DROP POLICY IF EXISTS assets_select ON assets;
CREATE POLICY assets_select ON assets
  FOR SELECT USING (
    is_public = true OR
    owner_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS assets_own ON assets;
CREATE POLICY assets_own ON assets
  FOR ALL USING (owner_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
  WITH CHECK (owner_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Works: Published public, own all access
DROP POLICY IF EXISTS works_select ON works;
CREATE POLICY works_select ON works
  FOR SELECT USING (
    (status = 'published' AND deleted_at IS NULL) OR
    creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS works_creator_manage ON works;
CREATE POLICY works_creator_manage ON works
  FOR ALL USING (creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
  WITH CHECK (creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Categories & Tags: Public read
DROP POLICY IF EXISTS categories_public_read ON categories;
CREATE POLICY categories_public_read ON categories
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS tags_public_read ON tags;
CREATE POLICY tags_public_read ON tags
  FOR SELECT USING (true);

-- ============================================================================
-- 5. INITIAL DATA
-- ============================================================================

-- Insert default categories
INSERT INTO categories (id, name, slug, path, level) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Landscape', 'landscape', '/landscape', 0),
  ('00000000-0000-0000-0000-000000000002', 'Portrait', 'portrait', '/portrait', 0),
  ('00000000-0000-0000-0000-000000000003', 'Urban', 'urban', '/urban', 0),
  ('00000000-0000-0000-0000-000000000004', 'Nature', 'nature', '/nature', 0),
  ('00000000-0000-0000-0000-000000000005', 'Abstract', 'abstract', '/abstract', 0)
ON CONFLICT (id) DO NOTHING;

-- Mark migration complete
INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v6_schema_foundation', 'foundation')
ON CONFLICT (version) DO NOTHING;
