-- RLS (Row Level Security) ポリシー設定

-- 通知設定テーブルのRLS
ALTER TABLE user_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification settings" ON user_notification_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification settings" ON user_notification_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification settings" ON user_notification_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification settings" ON user_notification_settings
    FOR DELETE USING (auth.uid() = user_id);

-- プライバシー設定テーブルのRLS
ALTER TABLE user_privacy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own privacy settings" ON user_privacy_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own privacy settings" ON user_privacy_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own privacy settings" ON user_privacy_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own privacy settings" ON user_privacy_settings
    FOR DELETE USING (auth.uid() = user_id);

-- 注文ステータス履歴テーブルのRLS
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view order status for their purchases" ON order_status_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM purchases
            WHERE purchases.id = order_status_history.purchase_id
            AND purchases.user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert order status history" ON order_status_history
    FOR INSERT WITH CHECK (true);

-- 住所テーブルのRLS（既存の場合はスキップ）
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own addresses" ON user_addresses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own addresses" ON user_addresses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own addresses" ON user_addresses
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own addresses" ON user_addresses
    FOR DELETE USING (auth.uid() = user_id);

-- ストレージバケットのRLS（ユーザーコンテンツ用）
INSERT INTO storage.buckets (id, name, public) VALUES ('user-content', 'user-content', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Users can upload their own avatar" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'user-content' AND
        (storage.foldername(name))[1] = 'avatars' AND
        auth.uid()::text = (storage.foldername(name))[2]
    );

CREATE POLICY "Users can view their own avatar" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'user-content' AND
        (storage.foldername(name))[1] = 'avatars' AND
        auth.uid()::text = (storage.foldername(name))[2]
    );

CREATE POLICY "Public can view avatars" ON storage.objects
    FOR SELECT USING (bucket_id = 'user-content' AND (storage.foldername(name))[1] = 'avatars');