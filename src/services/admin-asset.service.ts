import { supabase } from './supabaseClient'

export type AssetPolicy = { id: string; pattern: string; rule: 'allow'|'deny'|'manual'; notes?: string; updated_at?: string }
export type OnlineAsset = { id: string; owner_user_id: string; source_url: string; provider?: string; status: string; created_at?: string }

export async function listAssetPolicies(): Promise<AssetPolicy[]> {
  const { data, error } = await supabase.functions.invoke('admin-asset-policy', { body: { action: 'list' } })
  if (error) throw error
  return (data?.items || []) as AssetPolicy[]
}

export async function upsertAssetPolicy(p: Partial<AssetPolicy>): Promise<AssetPolicy> {
  const { data, error } = await supabase.functions.invoke('admin-asset-policy', { body: { action: 'upsert', ...p } })
  if (error) throw error
  return data.item as AssetPolicy
}

export async function deleteAssetPolicy(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('admin-asset-policy', { body: { action: 'delete', id } })
  if (error) throw error
}

export async function listPendingAssets(): Promise<OnlineAsset[]> {
  const { data, error } = await supabase.functions.invoke('admin-assets', { body: { action: 'list_pending' } })
  if (error) throw error
  return (data?.items || []) as OnlineAsset[]
}

export async function approveAsset(asset_id: string, reason?: string): Promise<void> {
  const { error } = await supabase.functions.invoke('admin-assets', { body: { action: 'approve', asset_id, reason } })
  if (error) throw error
}

export async function rejectAsset(asset_id: string, reason?: string): Promise<void> {
  const { error } = await supabase.functions.invoke('admin-assets', { body: { action: 'reject', asset_id, reason } })
  if (error) throw error
}

