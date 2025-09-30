import { supabase } from './supabaseClient'

export type LiveOffer = {
  id: string
  work_id: string
  creator_id: string
  live_event_id?: string
  start_at: string
  end_at: string
  status: 'draft'|'published'|'archived'
  price_override?: number
  currency: string
  stock_total: number
  stock_reserved: number
  stock_sold: number
  per_user_limit?: number
  perks_type: 'none'|'signed'|'limited_design'
  perks?: Record<string, any>
  image_preview_path?: string
  variant_original_path?: string
  variant_preview_path?: string
}

export async function createLiveOffer(payload: Partial<LiveOffer> & { work_id: string; start_at: string; end_at: string; stock_total: number }) {
  const { data, error } = await supabase.functions.invoke('live-offers-manage', {
    body: { action: 'create', ...payload }
  })
  if (error) throw error
  return (data as any).item as LiveOffer
}

export async function updateLiveOffer(id: string, patch: Partial<LiveOffer>) {
  const { data, error } = await supabase.functions.invoke('live-offers-manage', {
    body: { action: 'update', id, ...patch }
  })
  if (error) throw error
  return (data as any).item as LiveOffer
}

export async function publishLiveOffer(id: string) {
  const { data, error } = await supabase.functions.invoke('live-offers-manage', {
    body: { action: 'publish', id }
  })
  if (error) throw error
  return (data as any).item as LiveOffer
}

export async function archiveLiveOffer(id: string) {
  const { data, error } = await supabase.functions.invoke('live-offers-manage', {
    body: { action: 'archive', id }
  })
  if (error) throw error
  return (data as any).item as LiveOffer
}

export async function listMyLiveOffers() {
  const { data, error } = await supabase.functions.invoke('live-offers-manage', {
    body: { action: 'list_mine' }
  })
  if (error) throw error
  return (data as any).items as LiveOffer[]
}

export async function listLiveOffersForEvent(eventId?: string) {
  const params = eventId ? `?event_id=${encodeURIComponent(eventId)}` : ''
  const res = await fetch(`${(supabase as any).functionsUrl}/live-offers-list${params}`, {
    headers: (supabase as any).functions._headers()
  } as any)
  if (!res.ok) throw new Error(`list failed: ${res.status}`)
  const json = await res.json()
  return json.items as any[]
}

export async function acquireLiveOfferLock(liveOfferId: string) {
  const { data, error } = await supabase.functions.invoke('live-offers-lock', {
    body: { action: 'acquire', live_offer_id: liveOfferId }
  })
  if (error) throw error
  return (data as any).locked === true
}

export async function releaseLiveOfferLock(liveOfferId: string) {
  const { data, error } = await supabase.functions.invoke('live-offers-lock', {
    body: { action: 'release', live_offer_id: liveOfferId }
  })
  if (error) throw error
  return (data as any).released === true
}

export async function createLiveOfferIntent(liveOfferId: string) {
  const { data, error } = await supabase.functions.invoke('live-offers-create-intent', {
    body: { live_offer_id: liveOfferId }
  })
  if (error) throw error
  return { clientSecret: (data as any).clientSecret ?? (data as any).client_secret }
}

