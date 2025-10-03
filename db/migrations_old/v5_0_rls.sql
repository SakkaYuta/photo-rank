-- Archived copy of v5.0 RLS (truncated)

ALTER TABLE public.manufacturing_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_orders ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin(p_user uuid)
RETURNS boolean AS $$
  SELECT EXISTS(SELECT 1 FROM public.users u WHERE u.id = p_user AND u.role = 'admin');
$$ LANGUAGE sql STABLE;

-- Policies omitted; see original file for full set

INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v5.0_rls', 'local')
ON CONFLICT (version) DO NOTHING;

