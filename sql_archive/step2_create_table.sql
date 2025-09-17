-- ステップ2: 新しいテーブル作成
CREATE TABLE public.rate_limits (
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  request_count integer DEFAULT 0,
  window_hour integer DEFAULT 0,
  last_reset timestamptz DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, action_type)
);