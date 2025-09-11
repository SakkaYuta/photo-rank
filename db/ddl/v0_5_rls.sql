-- PhotoRank v0.5 RLS & policies
-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_availability ENABLE ROW LEVEL SECURITY;

-- Users policies
DROP POLICY IF EXISTS users_select_policy ON public.users;
CREATE POLICY users_select_policy ON public.users
  FOR SELECT USING (true);
DROP POLICY IF EXISTS users_update_self ON public.users;
CREATE POLICY users_update_self ON public.users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Works policies
DROP POLICY IF EXISTS works_select_public ON public.works;
CREATE POLICY works_select_public ON public.works
  FOR SELECT USING (is_published = true OR creator_id = auth.uid());
DROP POLICY IF EXISTS works_write_own ON public.works;
CREATE POLICY works_write_own ON public.works
  FOR ALL USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());

-- Purchases policies
DROP POLICY IF EXISTS purchases_self ON public.purchases;
CREATE POLICY purchases_self ON public.purchases
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Votes policies
DROP POLICY IF EXISTS votes_self ON public.votes;
CREATE POLICY votes_self ON public.votes
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Goods orders policies
DROP POLICY IF EXISTS goods_orders_self ON public.goods_orders;
CREATE POLICY goods_orders_self ON public.goods_orders
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Payout accounts policies
DROP POLICY IF EXISTS payout_accounts_policy ON public.payout_accounts;
CREATE POLICY payout_accounts_policy ON public.payout_accounts
  FOR ALL USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  ) WITH CHECK (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Event & gift (read public, writes restricted)
DROP POLICY IF EXISTS gift_transactions_insert_self ON public.gift_transactions;
CREATE POLICY gift_transactions_insert_self ON public.gift_transactions
  FOR INSERT WITH CHECK (sender_id = auth.uid());
DROP POLICY IF EXISTS gift_transactions_select_public ON public.gift_transactions;
CREATE POLICY gift_transactions_select_public ON public.gift_transactions
  FOR SELECT USING (true);
