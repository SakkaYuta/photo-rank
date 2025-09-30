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
    { value: 'factory' as UserType, label: '工場製造パートナー' },
    { value: 'organizer' as UserType, label: 'オーガナイザー' }
  ];

  // オーガナイザー表示時は「工場」「一般ユーザー」を候補から除外
  const availableRoles = roles.filter(r => {
    if (userType === 'organizer' && (r.value === 'factory' || r.value === 'general')) return false;
    return true;
  });

  const handleRoleChange = async (newRole: UserType) => {
    try {
      console.log('Switching to role:', newRole);
      await switchRole(newRole);
      setIsOpen(false);

      // Force page reload to ensure proper role detection
      setTimeout(() => {
        window.location.reload();
      }, 100);
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

  // ロール切り替えボタンは非表示（開発環境でのみ必要な場合はコメント解除）
  return null;
};

export default RoleSwitcher;
