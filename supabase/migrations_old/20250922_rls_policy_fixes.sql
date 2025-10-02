-- RLSポリシー修正：作品所有者による関連データ管理を許可
-- 作品削除時に作品の作成者が関連するお気に入りとカートアイテムを削除できるように調整

-- favoritesテーブルのポリシー修正
DROP POLICY IF EXISTS "favorites_owner_all" ON public.favorites;
CREATE POLICY "favorites_owner_all" ON public.favorites
  FOR ALL USING (
    user_id = auth.uid() OR -- ユーザー自身のお気に入り
    EXISTS (
      SELECT 1 FROM public.works
      WHERE works.id = favorites.work_id
      AND works.user_id = auth.uid()
    ) -- 作品の作成者による削除も許可
  )
  WITH CHECK (user_id = auth.uid()); -- 作成時は自分のみ

-- cart_itemsテーブルのポリシー修正
DROP POLICY IF EXISTS "cart_items_owner_all" ON public.cart_items;
CREATE POLICY "cart_items_owner_all" ON public.cart_items
  FOR ALL USING (
    user_id = auth.uid() OR -- ユーザー自身のカートアイテム
    EXISTS (
      SELECT 1 FROM public.works
      WHERE works.id = cart_items.work_id
      AND works.user_id = auth.uid()
    ) -- 作品の作成者による削除も許可
  )
  WITH CHECK (user_id = auth.uid()); -- 作成時は自分のみ

-- purchasesテーブルのポリシーも同様に調整（作品の作成者が販売データを見れるように）
DROP POLICY IF EXISTS "purchases_owner_select" ON public.purchases;
CREATE POLICY "purchases_owner_select" ON public.purchases
  FOR SELECT USING (
    user_id = auth.uid() OR -- 購入者自身
    EXISTS (
      SELECT 1 FROM public.works
      WHERE works.id = purchases.work_id
      AND works.user_id = auth.uid()
    ) -- 作品の作成者も販売データを確認可能
  );

-- 作品テーブルのポリシーも確認・追加（存在しない場合のため）
DO $$ BEGIN
  IF to_regclass('public.works') IS NOT NULL THEN
    -- 作品の所有者ポリシー
    DROP POLICY IF EXISTS "works_owner_all" ON public.works;
    CREATE POLICY "works_owner_all" ON public.works
      FOR ALL USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());

    -- 作品の公開閲覧ポリシー
    DROP POLICY IF EXISTS "works_public_select" ON public.works;
    CREATE POLICY "works_public_select" ON public.works
      FOR SELECT USING (is_published = true);

    -- RLS有効化
    ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- サービスロールバイパスポリシー（管理操作用）
DROP POLICY IF EXISTS "service_role_bypass_works" ON public.works;
DO $$ BEGIN
  IF to_regclass('public.works') IS NOT NULL THEN
    CREATE POLICY "service_role_bypass_works" ON public.works
      FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- インデックス追加（パフォーマンス向上のため）
DO $$ BEGIN
  IF to_regclass('public.works') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_works_user_id ON public.works(user_id);
    CREATE INDEX IF NOT EXISTS idx_works_published ON public.works(is_published) WHERE is_published = true;
  END IF;

  IF to_regclass('public.favorites') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_favorites_work_id ON public.favorites(work_id);
  END IF;

  IF to_regclass('public.cart_items') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_cart_items_work_id ON public.cart_items(work_id);
  END IF;

  IF to_regclass('public.purchases') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_purchases_work_id ON public.purchases(work_id);
  END IF;
END $$;

-- コメント追加
COMMENT ON POLICY "favorites_owner_all" ON public.favorites IS 'ユーザー自身のお気に入り、または作品作成者による管理を許可';
COMMENT ON POLICY "cart_items_owner_all" ON public.cart_items IS 'ユーザー自身のカートアイテム、または作品作成者による管理を許可';
COMMENT ON POLICY "purchases_owner_select" ON public.purchases IS '購入者と作品作成者が販売データを確認可能';