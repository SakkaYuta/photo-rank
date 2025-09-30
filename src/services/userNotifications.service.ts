import { supabase } from './supabaseClient'

export type AppNotification = {
  id: string
  user_id: string
  type: string
  title?: string | null
  message?: string | null
  data?: Record<string, any>
  read: boolean
  read_at?: string | null
  created_at: string
}

export async function listMyNotifications(limit: number = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('user_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as any) || []
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('user_notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

