import { supabase } from '@/services/supabaseClient'

const SAMPLE_BUCKET = (import.meta as any).env?.VITE_SAMPLE_BUCKET || 'user-content'

const path = (envKey: string, fallback: string) =>
  ((import.meta as any).env?.[envKey] as string) || fallback

export const defaultImages = {
  product: supabase.storage.from(SAMPLE_BUCKET).getPublicUrl(path('VITE_DEFAULT_PRODUCT_IMAGE_PATH', 'defaults/product.jpg')).data.publicUrl,
  avatar: supabase.storage.from(SAMPLE_BUCKET).getPublicUrl(path('VITE_DEFAULT_AVATAR_IMAGE_PATH', 'defaults/avatar.jpg')).data.publicUrl,
  creator: supabase.storage.from(SAMPLE_BUCKET).getPublicUrl(path('VITE_DEFAULT_CREATOR_IMAGE_PATH', 'defaults/creator.jpg')).data.publicUrl,
  content: supabase.storage.from(SAMPLE_BUCKET).getPublicUrl(path('VITE_DEFAULT_CONTENT_IMAGE_PATH', 'defaults/content.jpg')).data.publicUrl,
  work: supabase.storage.from(SAMPLE_BUCKET).getPublicUrl(path('VITE_DEFAULT_WORK_IMAGE_PATH', 'defaults/work.jpg')).data.publicUrl,
}

