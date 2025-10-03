import { useEffect, useState } from 'react'
import { supabase } from '@/services/supabaseClient'
import { setupUserProfileAfterAuth } from '@/services/auth.service'
import { useToast } from '@/contexts/ToastContext'
import { defaultViewFor, type RoleKey } from '@/routes'

export function AuthCallbackGate() {
  const [message, setMessage] = useState('Google認証処理中...')
  const { showToast } = useToast()

  // ユーザーのロールに基づいてリダイレクト先を決定
  const getRoleBasedRedirect = async (): Promise<string> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return '#merch'

      // user_roles テーブルでロールを確認
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)

      const userRoles = new Set((roles || []).map((r: any) => r.role))

      // partner_users と organizer_profiles を取得
      const [partnerResult, organizerResult] = await Promise.all([
        supabase.from('partner_users').select('partner_id').eq('user_id', user.id).maybeSingle(),
        supabase.from('organizer_profiles').select('user_id').eq('user_id', user.id).maybeSingle(),
      ])

      // ロール優先順位で決定
      let roleKey: RoleKey = 'general'
      if (organizerResult.data) {
        roleKey = 'organizer'
      } else if (partnerResult.data) {
        roleKey = 'factory'
      } else if (userRoles.has('creator')) {
        roleKey = 'creator'
      } else if (userRoles.has('admin')) {
        roleKey = 'admin'
      }

      const defaultView = defaultViewFor(roleKey)
      return `#${defaultView}`
    } catch (error) {
      console.error('Error determining role-based redirect:', error)
      return '#merch'
    }
  }

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search)
      const error = params.get('error') || params.get('error_description')
      const code = params.get('code')
      const nextParam = params.get('next')
      if (error) {
        setMessage(`認証エラー: ${error}`)
        showToast({
          variant: 'error',
          title: 'ログイン失敗',
          message: `認証エラーが発生しました: ${error}`,
          duration: 5000
        })
        // 3秒後にホームへリダイレクト
        setTimeout(() => {
          window.location.hash = '#'
        }, 3000)
        return
      }
      if (!code) {
        // まず既にセッションが存在するか確認（Implicitフローやブラウザ差異の保険）
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData.session) {
          // セッションがあれば通常フローへ
          showToast({
            variant: 'success',
            title: 'ログイン成功！',
            message: '認証が完了しました',
            duration: 3000
          })
          let redirect = await getRoleBasedRedirect()
          try {
            if (nextParam) {
              const decoded = decodeURIComponent(nextParam)
              redirect = decoded.startsWith('#') ? decoded : `#${decoded}`
            } else {
              const saved = localStorage.getItem('postLoginRedirect')
              if (saved) {
                redirect = saved.startsWith('#') ? saved : `#${saved}`
              }
            }
            localStorage.removeItem('postLoginRedirect')
            localStorage.removeItem('pendingSignUp')
            localStorage.removeItem('pendingUserType')
          } catch {}
          // ページをリロードしてリダイレクト（状態を完全にリセット）
          window.location.href = `/${redirect}`
          return
        }
        setMessage('認証コードが見つかりません。リダイレクトURLの設定（Additional Redirect URLs）をご確認ください。')
        showToast({
          variant: 'error',
          title: 'ログイン失敗',
          message: '認証コードが見つかりません。リダイレクトURLの設定をご確認ください。',
          duration: 6000
        })
        return
      }
      try {
        const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code)
        if (exchErr) throw exchErr

        // サインアップかログインかを判定
        const isSignUp = localStorage.getItem('pendingSignUp') === '1'

        // 会員情報の存在確認（users_vw 優先、なければ user_profiles）
        const { data: userObj } = await supabase.auth.getUser()
        const uid = userObj.user?.id
        if (!uid) throw new Error('ユーザー情報の取得に失敗しました')

        let exists = false
        try {
          const { data, error } = await supabase
            .from('users_vw')
            .select('id')
            .eq('id', uid)
            .maybeSingle()
          if (error && error.code !== 'PGRST116') throw error
          exists = !!data
        } catch (e: any) {
          // users_vw が無い場合は user_profiles を確認
          const { data, error } = await supabase
            .from('user_profiles')
            .select('user_id')
            .eq('user_id', uid)
            .maybeSingle()
          if (error && error.code !== 'PGRST116') throw error
          exists = !!data
        }

        if (isSignUp) {
          // 新規登録フロー: 既存なら案内、なければ作成
          if (exists) {
            showToast({
              variant: 'warning',
              title: 'すでに会員登録済み',
              message: '同じ情報の会員が存在するため、新規登録は行いませんでした。',
              duration: 4000
            })
          } else {
            try {
              await setupUserProfileAfterAuth()
              showToast({
                variant: 'success',
                title: '会員登録成功！',
                message: '会員登録が完了しました。ようこそ！',
                duration: 3000
              })
              exists = true
            } catch (e) {
              console.warn('Profile setup failed after OAuth (sign-up):', e)
              setMessage('会員登録処理に失敗しました。時間を置いて再試行してください。')
              showToast({
                variant: 'error',
                title: '登録失敗',
                message: '会員登録処理に失敗しました。時間を置いて再試行してください。',
                duration: 6000
              })
            }
          }
        } else {
          // ログインフロー: 会員が無ければログイン失敗
          if (!exists) {
            await supabase.auth.signOut()
            setMessage('会員情報が見つからないため、ログインできません。先に新規登録を行ってください。')
            showToast({
              variant: 'error',
              title: 'ログイン失敗',
              message: '会員情報が見つかりません。新規会員登録を行ってください。',
              duration: 6000
            })
            try {
              localStorage.removeItem('pendingSignUp')
              localStorage.removeItem('pendingUserType')
              localStorage.removeItem('postLoginRedirect')
            } catch {}
            // ページをリロードしてトップへ
            window.location.href = '/#merch'
            return
          } else {
            showToast({
              variant: 'success',
              title: 'ログイン成功！',
              message: 'ログインが完了しました',
              duration: 3000
            })
          }
        }

        // 復帰先（ログイン直前に保存したハッシュまたはロール別ダッシュボード）
        let redirect = await getRoleBasedRedirect()
        try {
          if (nextParam) {
            const decoded = decodeURIComponent(nextParam)
            redirect = decoded.startsWith('#') ? decoded : `#${decoded}`
          } else {
            const saved = localStorage.getItem('postLoginRedirect')
            if (saved) {
              redirect = saved.startsWith('#') ? saved : `#${saved}`
            }
          }
          // フラグをクリア
          localStorage.removeItem('postLoginRedirect')
          localStorage.removeItem('pendingSignUp')
          localStorage.removeItem('pendingUserType')
        } catch {}
        // ページをリロードしてリダイレクト（状態を完全にリセット）
        window.location.href = `/${redirect}`
      } catch (e: any) {
        setMessage(`セッション確立に失敗しました: ${e?.message || '不明なエラー'}`)
        showToast({
          variant: 'error',
          title: 'ログイン失敗',
          message: `セッション確立に失敗しました: ${e?.message || '不明なエラー'}`,
          duration: 6000
        })
      }
    }
    run()
  }, [showToast])

  return (
    <div className="min-h-screen grid place-items-center">
      <div className="text-center">
        <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
        <p className="text-gray-700">{message}</p>
      </div>
    </div>
  )
}

export default AuthCallbackGate
