-- ステップ5: 監査ログテーブル作成
-- まずテーブルが存在するかチェックして、存在しない場合は作成
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='audit_logs'
  ) THEN
    -- テーブルが存在しない場合は作成
    CREATE TABLE public.audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid,
      action text NOT NULL,
      table_name text,
      record_id uuid,
      old_data jsonb,
      new_data jsonb,
      ip_address inet,
      user_agent text,
      severity text DEFAULT 'info',
      risk_score integer DEFAULT 0,
      created_at timestamptz DEFAULT CURRENT_TIMESTAMP
    );
  ELSE
    -- テーブルが存在する場合はカラム追加
    -- severity カラム追加
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='audit_logs' AND column_name='severity'
    ) THEN
      ALTER TABLE public.audit_logs ADD COLUMN severity text DEFAULT 'info';
    END IF;
    
    -- risk_score カラム追加
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='audit_logs' AND column_name='risk_score'
    ) THEN
      ALTER TABLE public.audit_logs ADD COLUMN risk_score integer DEFAULT 0;
    END IF;
  END IF;
END $$;