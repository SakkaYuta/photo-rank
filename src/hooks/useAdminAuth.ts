import { useState, useEffect } from 'react'
import { supabase } from '../services/supabaseClient'
import { useAuth } from './useAuth'

export interface AdminUser {
  id: string
  email: string
  role: 'admin' | 'moderator'
  display_name?: string
  avatar_url?: string
}

export function useAdminAuth() {
  const { profile } = useAuth()
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) {
      setAdminUser(null)
      setIsLoading(false)
      return
    }

    const checkAdminStatus = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // 認証ユーザー取得（安全なID取得）
        const { data: auth } = await supabase.auth.getUser()
        const authUser = auth?.user
        if (!authUser) {
          setAdminUser(null)
          setIsLoading(false)
          return
        }

        // データベースから正確なロール情報を取得
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, role, display_name, avatar_url')
          .eq('id', authUser.id)
          .in('role', ['admin', 'moderator'])
          .single()

        if (error) {
          if (error.code === 'PGRST116') {
            // No rows found - user is not admin
            setAdminUser(null)
          } else {
            throw error
          }
        } else if (data && (data.role === 'admin' || data.role === 'moderator')) {
          setAdminUser({
            id: data.id,
            email: data.email,
            role: data.role as 'admin' | 'moderator',
            display_name: data.display_name,
            avatar_url: data.avatar_url
          })
        } else {
          setAdminUser(null)
        }
      } catch (err) {
        console.error('Error checking admin status:', err)
        setError(err instanceof Error ? err.message : '管理者権限の確認に失敗しました')
        setAdminUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    checkAdminStatus()
  }, [profile])

  const isAdmin = adminUser?.role === 'admin'
  const isModerator = adminUser?.role === 'moderator'
  const isAdminOrModerator = isAdmin || isModerator

  return {
    adminUser,
    isAdmin,
    isModerator,
    isAdminOrModerator,
    isLoading,
    error
  }
}
