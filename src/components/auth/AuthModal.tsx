import { signInWithGoogle } from '../../services/auth.service'

export function AuthModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold">ログイン</h2>
        <p className="mb-4 text-sm text-gray-600">Googleアカウントでログインします。</p>
        <div className="flex justify-end gap-2">
          <button className="btn btn-outline" onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" onClick={() => signInWithGoogle()}>Googleでログイン</button>
        </div>
      </div>
    </div>
  )
}

