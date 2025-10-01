import { supabase } from './supabaseClient'
import type { User } from '../types'
import type { UserType } from '../types/user'
import { isDemoEnabled } from '../utils/demo'

export async function signInWithGoogle(userType: UserType = 'general') {
  // ログイン時に選択されたユーザータイプをローカルストレージに保存
  localStorage.setItem('pendingUserType', userType);
  // 直前の画面へ戻すためのリダイレクト先（デフォルトはトップ）
  try {
    const current = window.location.hash && window.location.hash.length > 1 ? window.location.hash : '#merch'
    localStorage.setItem('postLoginRedirect', current)
  } catch {}

  // /auth/callback に next パラメータで復帰先を明示（localStorageフォールバックも保持）
  const next = (() => {
    try {
      const current = localStorage.getItem('postLoginRedirect') || '#merch'
      return encodeURIComponent(current)
    } catch { return encodeURIComponent('#merch') }
  })()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // Googleの"Continue to"に自ドメインを出すため、独自コールバックにリダイレクト
      redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
      queryParams: {
        prompt: 'select_account',
        // scopes はデフォルトで十分（openid email profile）。必要なら拡張
      },
      // 確実にPKCEコードフローで返す（/auth/callback?code=... 対応）
      flowType: 'pkce'
    }
  })
  if (error) throw error
  return data
}

// 認証後のユーザープロフィール設定
export async function setupUserProfileAfterAuth() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // ローカルストレージからユーザータイプを取得
  const pendingUserType = localStorage.getItem('pendingUserType') as UserType || 'general'
  localStorage.removeItem('pendingUserType')

  try {
    // 既存のユーザープロフィールを確認
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (fetchError && fetchError.code === 'PGRST116') {
      // ユーザーが存在しない場合、新規作成
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          display_name: user.user_metadata?.display_name || user.email?.split('@')[0],
          user_type: pendingUserType,
          is_creator: pendingUserType === 'creator',
          is_factory: pendingUserType === 'factory'
        })
        .select()
        .single()

      if (createError) throw createError
      return newUser
    } else if (fetchError) {
      throw fetchError
    } else {
      // ユーザーが既に存在する場合、ユーザータイプを更新（既存ユーザーが別のタイプでログインした場合）
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          user_type: pendingUserType,
          is_creator: pendingUserType === 'creator',
          is_factory: pendingUserType === 'factory'
        })
        .eq('id', user.id)
        .select()
        .single()

      if (updateError) throw updateError
      return updatedUser
    }
  } catch (error) {
    console.error('Error setting up user profile:', error)
    throw error
  }
}

export async function signOut() {
  // デモユーザーの場合
  const demoUser = getDemoUser()
  if (demoUser) {
    // 先にトップへ遷移してからデモログアウト
    try { window.location.hash = '#merch' } catch {}
    return signOutDemo()
  }

  const { error } = await supabase.auth.signOut()
  if (error) throw error
  // ログアウト後はトップへ強制遷移
  try {
    // ユーティリティがあればそれを使う
    import('@/utils/navigation').then(m => m.navigate('merch')).catch(() => {
      try { window.location.hash = '#merch' } catch {}
    })
  } catch {
    try { window.location.hash = '#merch' } catch {}
  }
}

// デモモード用のログイン機能
export async function signInWithDemo(userType: UserType = 'general') {
  if (!isDemoEnabled()) {
    throw new Error('Demo mode is disabled on this host')
  }
  // デモユーザー情報をローカルストレージに保存
  const demoUser = {
    id: `demo-${userType}-${Date.now()}`,
    email: `demo-${userType}@example.com`,
    display_name: `デモ${userType === 'general' ? 'ユーザー' : userType === 'creator' ? 'クリエイター' : userType === 'factory' ? '工場' : 'オーガナイザー'}`,
    user_type: userType,
    is_creator: userType === 'creator',
    is_factory: userType === 'factory',
    is_demo: true
  }

  localStorage.setItem('demoUser', JSON.stringify(demoUser))

  // ページをリロードして状態を更新
  window.location.reload()

  return { user: demoUser }
}

// デモユーザーをログアウト
export async function signOutDemo() {
  localStorage.removeItem('demoUser')
  // 既にハッシュは '#merch' にしているが、念のため再設定
  try { window.location.hash = '#merch' } catch {}
  window.location.reload()
}

// デモユーザーの取得
export function getDemoUser() {
  if (!isDemoEnabled()) return null
  const demoUserStr = localStorage.getItem('demoUser')
  return demoUserStr ? JSON.parse(demoUserStr) : null
}

export async function getCurrentUserProfile(): Promise<User | null> {
  // デモモードの確認
  const demoUser = getDemoUser()
  if (demoUser) {
    return demoUser as User
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()
  if (error) throw error

  // Supabase Authからメール情報を追加
  return {
    ...data,
    email: user.email || null
  } as User
}
