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
          } catch {}
          try { window.history.replaceState(null, '', '/auth/callback') } catch {}
          window.location.hash = redirect
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

        // プロフィール作成/更新（サインアップモードやpendingUserTypeがある場合に実行）
        try {
          const pendingType = localStorage.getItem('pendingUserType')
          const pendingSignUp = localStorage.getItem('pendingSignUp')
          if (pendingType || pendingSignUp) {
            await setupUserProfileAfterAuth()
          }
        } catch (e) {
          // 続行するがメッセージ表示
          console.warn('Profile setup failed after OAuth:', e)
          setMessage('認証は成功しましたが、プロフィール作成に失敗しました。後でアカウント設定から情報を更新してください。')
          showToast({
            variant: 'warning',
            title: '認証成功',
            message: '認証は成功しましたが、プロフィール作成に失敗しました。後でアカウント設定から情報を更新してください。',
            duration: 5000
          })
        }

        // 成功トースト表示
        showToast({
          variant: 'success',
          title: isSignUp ? '会員登録成功！' : 'ログイン成功！',
          message: isSignUp ? '会員登録が完了しました。ようこそ！' : 'ログインが完了しました',
          duration: 3000
        })

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
        } catch {}
        // クエリを消してからハッシュへ遷移
        try { window.history.replaceState(null, '', '/auth/callback') } catch {}
        window.location.hash = redirect
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
