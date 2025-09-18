import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { AuthModal } from './AuthModal'
import { signOut } from '../../services/auth.service'
import { Settings } from 'lucide-react'

export function UserMenu() {
  const { profile, loading } = useAuth()
  const [open, setOpen] = useState(false)
  const [showProfileSettings, setShowProfileSettings] = useState(false)

  if (loading) return <div className="h-8 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
  if (!profile) return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>ログイン</button>
      {open && <AuthModal onClose={() => setOpen(false)} />}
    </>
  )
  const handleProfileClick = () => {
    setShowProfileSettings(true);
  };

  if (showProfileSettings) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow p-6 max-w-2xl w-full mx-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">プロフィール設定</h1>
            <button
              onClick={() => setShowProfileSettings(false)}
              className="text-gray-600 hover:text-gray-800"
            >
              ✕
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                表示名
              </label>
              <input
                type="text"
                defaultValue={profile?.display_name || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                メールアドレス
              </label>
              <input
                type="email"
                defaultValue={profile?.email || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                自己紹介
              </label>
              <textarea
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="自己紹介を入力してください..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowProfileSettings(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                保存
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100 transition-colors"
        onClick={handleProfileClick}
        aria-label="プロフィール設定"
      >
        <Settings className="w-4 h-4 text-gray-600" />
      </button>
      <img
        src={profile.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${profile.id}`}
        alt="avatar"
        className="h-8 w-8 rounded-full cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
        onClick={handleProfileClick}
      />
      <span className="text-sm">{profile.display_name}</span>
      <button className="btn btn-outline" onClick={() => signOut()}>ログアウト</button>
    </div>
  )
}

