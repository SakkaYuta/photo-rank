-- v5.0 security fixes: address linter security issues
-- Fix RLS disabled issues and SECURITY DEFINER view warnings

-- ============================================================================
-- RLS有効化（既存テーブル）
-- ============================================================================

-- Enable RLS on existing tables that should have it
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- schema_migrations は管理テーブルなのでRLS不要（内部使用のみ）
-- public.rate_limits は既にRLS有効化済み

-- ============================================================================
-- 基本的なRLSポリシー作成
-- ============================================================================

-- Users: ユーザーは自分の情報のみ閲覧可能
DROP POLICY IF EXISTS users_own_data ON public.users;
CREATE POLICY users_own_data ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Works: 作品の閲覧は公開済みのもの、または自分の作品
DROP POLICY IF EXISTS works_visibility ON public.works;
CREATE POLICY works_visibility ON public.works
  FOR SELECT USING (
    status = 'published' OR creator_id = auth.uid()
  );

-- Works: 作品の更新は作成者のみ
DROP POLICY IF EXISTS works_creator_update ON public.works;
CREATE POLICY works_creator_update ON public.works
  FOR UPDATE USING (creator_id = auth.uid());

-- Purchases: 購入履歴は購入者と作品作成者のみ閲覧可能
DROP POLICY IF EXISTS purchases_access ON public.purchases;
CREATE POLICY purchases_access ON public.purchases
  FOR SELECT USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.works w 
      WHERE w.id = purchases.work_id AND w.creator_id = auth.uid()
    )
  );

-- ============================================================================
-- SECURITY DEFINER ビューの修正
-- ============================================================================

-- creator_earnings_v50 ビューからSECURITY DEFINERを削除
-- （通常のビューとして再作成）
DROP VIEW IF EXISTS public.creator_earnings_v50;
CREATE VIEW public.creator_earnings_v50 AS
SELECT 
  p.id as purchase_id,
  p.work_id,
  p.user_id as buyer_id,
  w.creator_id,
  p.price as sale_price,
  COALESCE(p.factory_payment, 0) as factory_payment,
  COALESCE(p.platform_total_revenue, 0) as platform_total_revenue,
  -- Creator profit = sale_price - factory_payment - platform_fees
  (p.price - COALESCE(p.factory_payment, 0) - COALESCE(p.platform_total_revenue, 0)) as creator_profit,
  p.purchased_at,
  p.status,
  w.organizer_id,
  u.display_name as creator_name
FROM public.purchases p
JOIN public.works w ON w.id = p.work_id
JOIN public.users u ON u.id = w.creator_id
WHERE p.status = 'paid';

-- ビューのRLS設定
ALTER VIEW public.creator_earnings_v50 SET (security_barrier = true);

-- creator_earnings_v50 ビューのアクセス制御
-- 作成者本人または管理者のみアクセス可能
CREATE OR REPLACE FUNCTION public.creator_earnings_v50_access()
RETURNS boolean AS $$
BEGIN
  -- 管理者は全てアクセス可能
  IF EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN true;
  END IF;
  
  -- 作成者は自分のデータのみアクセス可能
  RETURN EXISTS (
    SELECT 1 FROM public.creator_earnings_v50
    WHERE creator_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 管理者専用ポリシー
-- ============================================================================

-- 管理者のみアクセス可能なテーブル用のポリシー
CREATE OR REPLACE FUNCTION public.admin_only_access()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- パートナー関連テーブルのRLS（v5.0で追加されたテーブル）
-- ============================================================================

-- Manufacturing partners のRLS強化
DROP POLICY IF EXISTS manufacturing_partners_access ON public.manufacturing_partners;
CREATE POLICY manufacturing_partners_access ON public.manufacturing_partners
  FOR SELECT USING (
    status = 'approved' OR 
    owner_user_id = auth.uid() OR 
    public.admin_only_access()
  );

DROP POLICY IF EXISTS manufacturing_partners_owner_manage ON public.manufacturing_partners;
CREATE POLICY manufacturing_partners_owner_manage ON public.manufacturing_partners
  FOR UPDATE USING (
    owner_user_id = auth.uid() OR public.admin_only_access()
  );

-- Factory products のRLS
DROP POLICY IF EXISTS factory_products_visibility ON public.factory_products;
CREATE POLICY factory_products_visibility ON public.factory_products
  FOR SELECT USING (
    is_active = true OR
    EXISTS (
      SELECT 1 FROM public.manufacturing_partners mp
      WHERE mp.id = factory_products.partner_id 
        AND (mp.owner_user_id = auth.uid() OR public.admin_only_access())
    )
  );

-- Manufacturing orders のRLS
DROP POLICY IF EXISTS manufacturing_orders_access ON public.manufacturing_orders;
CREATE POLICY manufacturing_orders_access ON public.manufacturing_orders
  FOR SELECT USING (
    creator_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.manufacturing_partners mp
      WHERE mp.id = manufacturing_orders.partner_id 
        AND mp.owner_user_id = auth.uid()
    ) OR
    public.admin_only_access()
  );

-- ============================================================================
-- 検証とクリーンアップ
-- ============================================================================

-- RLS有効化状況の確認（情報提供のみ）
DO $$ 
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE 'RLS Status Check:';
  FOR rec IN 
    SELECT schemaname, tablename, rowsecurity
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename IN ('users', 'works', 'purchases', 'rate_limits', 'audit_logs',
                       'manufacturing_partners', 'factory_products', 'manufacturing_orders')
    ORDER BY tablename
  LOOP
    RAISE NOTICE 'Table %.%: RLS %', rec.schemaname, rec.tablename, 
      CASE WHEN rec.rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END;
  END LOOP;
END $$;

-- Mark security fixes as applied
INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v5.0_security_fixes', 'local')
ON CONFLICT (version) DO NOTHING;