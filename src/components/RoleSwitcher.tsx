import React, { useState } from 'react';
import { UserType } from '../types/user';
import { useUserRole } from '../hooks/useUserRole';
import { Settings, ChevronDown } from 'lucide-react';

interface RoleSwitcherProps {
  className?: string;
}

const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ className = '' }) => {
  const { userType, switchRole, loading } = useUserRole();
  const [isOpen, setIsOpen] = useState(false);

  const roles = [
    { value: 'general' as UserType, label: '一般ユーザー' },
    { value: 'creator' as UserType, label: 'クリエイター' },
    { value: 'organizer' as UserType, label: 'オーガナイザー' }
  ];

  const handleRoleChange = async (newRole: UserType) => {
    try {
      await switchRole(newRole);
      setIsOpen(false);
    } catch (error) {
      console.error('Role switch failed:', error);
    }
  };

  const setViewOverride = (mode: 'general' | 'auto') => {
    if (mode === 'general') {
      localStorage.setItem('view_override', 'general');
    } else {
      localStorage.removeItem('view_override');
    }
    window.dispatchEvent(new Event('view-override-changed'))
    setIsOpen(false)
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-sm text-gray-500 ${className}`}>
        <Settings className="w-4 h-4 animate-spin" />
        <span>読み込み中...</span>
      </div>
    );
  }

  // 一般ユーザーの場合は切り替えタブを非表示
  if (userType === 'general') {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        disabled={loading}
      >
        <Settings className="w-4 h-4" />
        <span>{roles.find(r => r.value === userType)?.label || 'ロール未設定'}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 min-w-40 bg-white border rounded-lg shadow-lg z-50">
          <div className="py-1">
            <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
              ロール切り替え（テスト用）
            </div>
            {roles.map((role) => (
              <button
                key={role.value}
                onClick={() => handleRoleChange(role.value)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                  userType === role.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                {role.label}
                {userType === role.value && (
                  <span className="ml-2 text-xs text-blue-600">（現在）</span>
                )}
              </button>
            ))}
            {(userType === 'creator' || userType === 'organizer') && (
              <>
                <div className="my-1 border-t" />
                <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  表示モード
                </div>
                <button
                  onClick={() => setViewOverride('general')}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors`}
                >
                  一般ユーザー表示に切り替え
                </button>
                <button
                  onClick={() => setViewOverride('auto')}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors`}
                >
                  通常表示に戻す
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default RoleSwitcher;
