import { useEffect, useState } from 'react'
import { supabase } from '@/services/supabaseClient'
import { setupUserProfileAfterAuth } from '@/services/auth.service'

export function AuthCallbackGate() {
  const [message, setMessage] = useState('Google認証処理中...')

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search)
      const error = params.get('error') || params.get('error_description')
      const code = params.get('code')
      const nextParam = params.get('next')
      if (error) {
        setMessage(`認証エラー: ${error}`)
        return
      }
      if (!code) {
        setMessage('認証コードが見つかりません。')
        return
      }
      try {
        const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code)
        if (exchErr) throw exchErr
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
        }

        // 復帰先（ログイン直前に保存したハッシュ）
        let redirect = '#merch'
        try {
          if (nextParam) {
            const decoded = decodeURIComponent(nextParam)
            redirect = decoded.startsWith('#') ? decoded : `#${decoded}`
          } else {
            const saved = localStorage.getItem('postLoginRedirect')
            if (saved) {
              redirect = saved.startsWith('#') ? saved : `#${saved}`
              localStorage.removeItem('postLoginRedirect')
            }
          }
          // サインアップフラグをクリア
          localStorage.removeItem('pendingSignUp')
        } catch {}
        // クエリを消してからハッシュへ遷移
        try { window.history.replaceState(null, '', '/auth/callback') } catch {}
        window.location.hash = redirect
      } catch (e: any) {
        setMessage(`セッション確立に失敗しました: ${e?.message || '不明なエラー'}`)
      }
    }
    run()
  }, [])

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
