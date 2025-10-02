-- Add live_offer_id to purchases and index
ALTER TABLE IF EXISTS public.purchases
  ADD COLUMN IF NOT EXISTS live_offer_id uuid REFERENCES public.live_offers(id);

-- Optional index to find purchases by live offer
CREATE INDEX IF NOT EXISTS idx_purchases_live_offer_id ON public.purchases(live_offer_id);

