-- Enhance manufacturing order relations and add partner-facing view

-- 1) Strengthen relational links on manufacturing_orders
ALTER TABLE public.manufacturing_orders
  ADD COLUMN IF NOT EXISTS factory_product_id uuid REFERENCES public.factory_products(id),
  ADD COLUMN IF NOT EXISTS purchase_id uuid REFERENCES public.purchases(id);

-- Helpful indexes for dashboards
CREATE INDEX IF NOT EXISTS idx_mo_partner ON public.manufacturing_orders(partner_id);
CREATE INDEX IF NOT EXISTS idx_mo_factory_product ON public.manufacturing_orders(factory_product_id);
CREATE INDEX IF NOT EXISTS idx_mo_work ON public.manufacturing_orders(work_id);
CREATE INDEX IF NOT EXISTS idx_mo_purchase ON public.manufacturing_orders(purchase_id);

-- 2) Status history table for manufacturing orders (optional but useful for audits/UI timelines)
CREATE TABLE IF NOT EXISTS public.manufacturing_order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturing_order_id uuid NOT NULL REFERENCES public.manufacturing_orders(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('submitted','accepted','in_production','shipped','cancelled','failed')),
  message text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mosh_order ON public.manufacturing_order_status_history(manufacturing_order_id, created_at);

-- 3) Partner dashboard consolidated view
-- Joins order, product, work, creator, customer in a single readable row
CREATE OR REPLACE VIEW public.partner_orders_view AS
SELECT
  mo.id,
  mo.order_id,
  mo.partner_id,
  mo.status,
  mo.created_at,
  mo.assigned_at,
  mo.shipped_at,
  mo.tracking_number,
  mo.factory_product_id,
  mo.work_id,
  mo.purchase_id,
  fp.product_type,
  COALESCE(fp.product_name, fp.product_type) AS product_name,
  w.title AS work_title,
  w.image_url AS work_image_url,
  w.creator_id,
  cu.display_name AS creator_name,
  cu.avatar_url AS creator_avatar,
  p.user_id AS customer_id,
  uu.display_name AS customer_name,
  uu.avatar_url AS customer_avatar
FROM public.manufacturing_orders mo
LEFT JOIN public.factory_products fp ON fp.id = mo.factory_product_id
LEFT JOIN public.works w ON w.id = mo.work_id
LEFT JOIN public.users cu ON cu.id = w.creator_id
LEFT JOIN public.purchases p ON p.id = mo.purchase_id
LEFT JOIN public.users uu ON uu.id = p.user_id;

-- Note: Apply RLS policies separately if RLS is enabled. At minimum,
-- restrict SELECT on partner_orders_view to rows where partner_id matches the session's partner.

