export type User = {
  id: string
  display_name: string
  bio?: string | null
  avatar_url?: string | null
  is_creator: boolean
  is_verified: boolean
  created_at: string
  email?: string | null
  phone?: string | null
  notification_settings?: UserNotificationSettings | null
  privacy_settings?: UserPrivacySettings | null
}

export type UserNotificationSettings = {
  email_notifications: boolean
  order_updates: boolean
  marketing_emails: boolean
  push_notifications: boolean
}

export type UserPrivacySettings = {
  profile_visibility: 'public' | 'private' | 'friends'
  show_purchase_history: boolean
  show_favorites: boolean
}

export type UserProfileUpdate = {
  display_name?: string
  bio?: string | null
  phone?: string | null
  notification_settings?: UserNotificationSettings
  privacy_settings?: UserPrivacySettings
}

