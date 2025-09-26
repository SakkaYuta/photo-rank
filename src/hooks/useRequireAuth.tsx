import { useState } from 'react'
import { useUserRole } from '@/hooks/useUserRole'
import { AuthModal } from '@/components/auth/AuthModal'
import { LoginRequiredPopup } from '@/components/auth/LoginRequiredPopup'

export function useRequireAuth() {
  const { user } = useUserRole()
  const [showPrompt, setShowPrompt] = useState(false)
  const [showAuth, setShowAuth] = useState(false)

  const requireAuth = (): boolean => {
    if (!user) {
      setShowPrompt(true)
      return false
    }
    return true
  }

  const openAuth = () => setShowAuth(true)
  const openPrompt = () => setShowPrompt(true)

  const LoginGate = () => (
    <>
      {showPrompt && (
        <LoginRequiredPopup
          onClose={() => setShowPrompt(false)}
          onProceed={() => {
            setShowPrompt(false)
            setShowAuth(true)
          }}
        />
      )}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  )

  return { requireAuth, LoginGate, openAuth, openPrompt, isAuthed: !!user }
}

