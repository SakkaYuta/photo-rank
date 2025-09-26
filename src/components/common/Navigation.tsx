import React from 'react'

export function Navigation({}: {
  current: string,
  onChange: (key: string) => void,
  isAdmin?: boolean,
  isPartner?: boolean,
  hasProfile?: boolean,
  userType?: string
}) {
  return (
    <nav className="sticky top-[53px] z-10 border-b border-gray-200 bg-white shadow-soft">
      {/* メニューは CreatorDashboard 側のボタンに移設 */}
    </nav>
  )
}
