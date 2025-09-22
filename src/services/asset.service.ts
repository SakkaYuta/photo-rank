import { supabase } from './supabaseClient'

export type IngestResult = {
  asset_id: string
  status: 'approved' | 'pending' | 'rejected' | 'blocked'
  policy?: 'allow' | 'deny' | 'manual'
  provider?: string
  metadata?: { title?: string; author?: string }
}

export async function ingestOnlineAsset(url: string, metadata?: { title?: string; author?: string }): Promise<IngestResult> {
  const { data, error } = await supabase.functions.invoke('ingest-online-asset', {
    body: { url, ...(metadata || {}) }
  })
  if (error) throw error
  return data as IngestResult
}

export async function generatePreview(assetId: string): Promise<{ preview_url: string; bucket: string }> {
  const { data, error } = await supabase.functions.invoke('generate-preview', {
    body: { asset_id: assetId }
  })
  if (error) throw error
  return data as { preview_url: string; bucket: string }
}

export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function createCustomProductIntent(params: {
  assetId: string
  productType: 'tshirt'|'mug'|'sticker'
  color?: string
  size?: string
  addressId?: string
}): Promise<{ clientSecret: string; workId: string }> {
  const { data, error } = await supabase.functions.invoke('create-custom-product-intent', {
    body: {
      asset_id: params.assetId,
      config: { product_type: params.productType, color: params.color, size: params.size },
      address_id: params.addressId
    }
  })
  if (error) throw error
  const clientSecret = (data as any).clientSecret ?? (data as any).client_secret
  return { clientSecret, workId: (data as any).workId }
}
