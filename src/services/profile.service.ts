import { supabase } from './supabaseClient'
import type { User, UserProfileUpdate, UserNotificationSettings, UserPrivacySettings } from '../types/user.types'

export class ProfileService {
  // プロフィール情報取得（メール情報含む）
  static async getProfile(): Promise<User | null> {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return null

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (error) throw error

    // Supabase Authからメール情報を取得
    return {
      ...data,
      email: authUser.email || null
    } as User
  }

  // プロフィール基本情報更新
  static async updateProfile(updates: UserProfileUpdate): Promise<User> {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) throw new Error('認証が必要です')

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', authUser.id)
      .select('*')
      .single()

    if (error) throw error

    return {
      ...data,
      email: authUser.email || null
    } as User
  }

  // メールアドレス変更
  static async updateEmail(newEmail: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({
      email: newEmail
    })
    if (error) throw error
  }

  // パスワード変更
  static async updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })
    if (error) throw error
  }

  // 通知設定取得
  static async getNotificationSettings(userId: string): Promise<UserNotificationSettings> {
    const { data, error } = await supabase
      .from('user_notification_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      // デフォルト設定を返す
      return {
        email_notifications: true,
        order_updates: true,
        marketing_emails: false,
        push_notifications: true
      }
    }

    return {
      email_notifications: data.email_notifications,
      order_updates: data.order_updates,
      marketing_emails: data.marketing_emails,
      push_notifications: data.push_notifications
    }
  }

  // 通知設定更新
  static async updateNotificationSettings(
    userId: string,
    settings: UserNotificationSettings
  ): Promise<void> {
    const { error } = await supabase
      .from('user_notification_settings')
      .upsert({
        user_id: userId,
        ...settings,
        updated_at: new Date().toISOString()
      })

    if (error) throw error
  }

  // プライバシー設定取得
  static async getPrivacySettings(userId: string): Promise<UserPrivacySettings> {
    const { data, error } = await supabase
      .from('user_privacy_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      // デフォルト設定を返す
      return {
        profile_visibility: 'public',
        show_purchase_history: false,
        show_favorites: true
      }
    }

    return {
      profile_visibility: data.profile_visibility,
      show_purchase_history: data.show_purchase_history,
      show_favorites: data.show_favorites
    }
  }

  // プライバシー設定更新
  static async updatePrivacySettings(
    userId: string,
    settings: UserPrivacySettings
  ): Promise<void> {
    const { error } = await supabase
      .from('user_privacy_settings')
      .upsert({
        user_id: userId,
        ...settings,
        updated_at: new Date().toISOString()
      })

    if (error) throw error
  }

  // アバター画像アップロード
  static async uploadAvatar(file: File): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('認証が必要です')

    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}_${Date.now()}.${fileExt}`
    const filePath = `avatars/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('user-content')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('user-content')
      .getPublicUrl(filePath)

    // ユーザープロフィールのavatar_urlを更新
    await this.updateProfile({
      avatar_url: data.publicUrl
    } as UserProfileUpdate)

    return data.publicUrl
  }

  // アカウント削除
  static async deleteAccount(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('認証が必要です')

    // 関連データの削除をSupabaseのカスケード削除に任せる
    // または明示的に削除する場合はここで実装

    // アカウント削除（実際の実装では管理者による論理削除が推奨）
    const { error } = await supabase.auth.admin.deleteUser(user.id)
    if (error) throw error
  }

  // プロフィール完全性チェック
  static getProfileCompleteness(profile: User): {
    percentage: number
    missingFields: string[]
  } {
    const requiredFields = ['display_name', 'email', 'phone']
    const optionalFields = ['bio', 'avatar_url']

    const missingRequired = requiredFields.filter(field => !profile[field as keyof User])
    const missingOptional = optionalFields.filter(field => !profile[field as keyof User])

    const totalFields = requiredFields.length + optionalFields.length
    const completedFields = totalFields - missingRequired.length - missingOptional.length

    const percentage = Math.round((completedFields / totalFields) * 100)

    return {
      percentage,
      missingFields: [...missingRequired, ...missingOptional]
    }
  }

  // 電話番号バリデーション
  static validatePhoneNumber(phone: string): boolean {
    // 日本の電話番号形式をチェック
    const phoneRegex = /^(\+81|0)[0-9]{1,4}-?[0-9]{1,4}-?[0-9]{4}$/
    return phoneRegex.test(phone.replace(/\s/g, ''))
  }

  // 表示名バリデーション
  static validateDisplayName(displayName: string): boolean {
    return displayName.trim().length >= 2 && displayName.trim().length <= 50
  }

  // バイオバリデーション
  static validateBio(bio: string): boolean {
    return bio.length <= 500
  }
}