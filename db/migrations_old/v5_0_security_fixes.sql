-- Archived copy of v5.0 security fixes (truncated)

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

DROP VIEW IF EXISTS public.creator_earnings_v50;
CREATE VIEW public.creator_earnings_v50 AS
SELECT p.id as purchase_id, p.work_id, p.user_id as buyer_id, w.creator_id,
       p.price as sale_price, COALESCE(p.factory_payment, 0) as factory_payment,
       COALESCE(p.platform_total_revenue, 0) as platform_total_revenue,
       (p.price - COALESCE(p.factory_payment, 0) - COALESCE(p.platform_total_revenue, 0)) as creator_profit,
       p.purchased_at, p.status, w.organizer_id, u.display_name as creator_name
FROM public.purchases p
JOIN public.works w ON w.id = p.work_id
JOIN public.users u ON u.id = w.creator_id
WHERE p.status = 'paid';

INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v5.0_security_fixes', 'local')
ON CONFLICT (version) DO NOTHING;

