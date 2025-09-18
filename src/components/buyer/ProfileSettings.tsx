import React, { useState, useEffect } from 'react'
import { User, Mail, Phone, Shield, Bell, MapPin, Camera, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { ProfileService } from '../../services/profile.service'
import { AddressService, type UserAddress } from '../../services/address.service'
import type { User as UserType, UserNotificationSettings, UserPrivacySettings } from '../../types/user.types'
import { useToast } from '../../contexts/ToastContext'
import Modal from '@/components/ui/Modal'

export function ProfileSettings() {
  const { profile } = useAuth()
  const { showToast } = useToast()

  // プロフィール基本情報
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  // パスワード変更
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // 設定
  const [notificationSettings, setNotificationSettings] = useState<UserNotificationSettings>({
    email_notifications: true,
    order_updates: true,
    marketing_emails: false,
    push_notifications: true
  })

  const [privacySettings, setPrivacySettings] = useState<UserPrivacySettings>({
    profile_visibility: 'public',
    show_purchase_history: false,
    show_favorites: true
  })

  // 住所帳
  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [newAddress, setNewAddress] = useState({
    name: '', postal_code: '', prefecture: '', city: '', address1: '', address2: '', phone: '', is_default: false
  })

  // 状態管理
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [completeness, setCompleteness] = useState({ percentage: 0, missingFields: [] as string[] })

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '')
      setBio(profile.bio || '')
      setPhone(profile.phone || '')
      setEmail(profile.email || '')

      // プロフィール完全性を計算
      const comp = ProfileService.getProfileCompleteness(profile)
      setCompleteness(comp)

      loadSettings()
      loadAddresses()
    }
  }, [profile])

  const loadSettings = async () => {
    if (!profile) return

    try {
      const [notifications, privacy] = await Promise.all([
        ProfileService.getNotificationSettings(profile.id),
        ProfileService.getPrivacySettings(profile.id)
      ])

      setNotificationSettings(notifications)
      setPrivacySettings(privacy)
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const loadAddresses = async () => {
    try {
      const addressList = await AddressService.list()
      setAddresses(addressList)
    } catch (error) {
      console.error('Failed to load addresses:', error)
    }
  }

  const handleProfileUpdate = async () => {
    if (!profile) return

    try {
      setSaving(true)

      // バリデーション
      if (!ProfileService.validateDisplayName(displayName)) {
        showToast({ message: '表示名は2文字以上50文字以下で入力してください', variant: 'error' })
        return
      }

      if (phone && !ProfileService.validatePhoneNumber(phone)) {
        showToast({ message: '正しい電話番号形式で入力してください', variant: 'error' })
        return
      }

      if (bio && !ProfileService.validateBio(bio)) {
        showToast({ message: '自己紹介は500文字以下で入力してください', variant: 'error' })
        return
      }

      await ProfileService.updateProfile({
        display_name: displayName,
        bio: bio || null,
        phone: phone || null
      })

      // メールアドレスが変更されている場合
      if (email !== profile.email) {
        await ProfileService.updateEmail(email)
        showToast({ message: 'メールアドレス確認メールを送信しました', variant: 'default' })
      }

      showToast({ message: 'プロフィールを更新しました', variant: 'success' })
    } catch (error: any) {
      showToast({ message: error.message || 'プロフィール更新に失敗しました', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordUpdate = async () => {
    if (newPassword !== confirmPassword) {
      showToast({ message: 'パスワードが一致しません', variant: 'error' })
      return
    }

    if (newPassword.length < 8) {
      showToast({ message: 'パスワードは8文字以上で入力してください', variant: 'error' })
      return
    }

    try {
      setSaving(true)
      await ProfileService.updatePassword(newPassword)
      setShowPasswordModal(false)
      setNewPassword('')
      setConfirmPassword('')
      showToast({ message: 'パスワードを更新しました', variant: 'success' })
    } catch (error: any) {
      showToast({ message: error.message || 'パスワード更新に失敗しました', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleNotificationUpdate = async () => {
    if (!profile) return

    try {
      setSaving(true)
      await ProfileService.updateNotificationSettings(profile.id, notificationSettings)
      showToast({ message: '通知設定を更新しました', variant: 'success' })
    } catch (error: any) {
      showToast({ message: error.message || '通知設定更新に失敗しました', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handlePrivacyUpdate = async () => {
    if (!profile) return

    try {
      setSaving(true)
      await ProfileService.updatePrivacySettings(profile.id, privacySettings)
      showToast({ message: 'プライバシー設定を更新しました', variant: 'success' })
    } catch (error: any) {
      showToast({ message: error.message || 'プライバシー設定更新に失敗しました', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleAddressAdd = async () => {
    try {
      setSaving(true)
      await AddressService.create(newAddress)
      await loadAddresses()
      setShowAddressModal(false)
      setNewAddress({ name: '', postal_code: '', prefecture: '', city: '', address1: '', address2: '', phone: '', is_default: false })
      showToast({ message: '住所を追加しました', variant: 'success' })
    } catch (error: any) {
      showToast({ message: error.message || '住所追加に失敗しました', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleAddressDelete = async (addressId: string) => {
    try {
      await AddressService.remove(addressId)
      await loadAddresses()
      showToast({ message: '住所を削除しました', variant: 'success' })
    } catch (error: any) {
      showToast({ message: error.message || '住所削除に失敗しました', variant: 'error' })
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setSaving(true)
      await ProfileService.uploadAvatar(file)
      showToast({ message: 'プロフィール画像を更新しました', variant: 'success' })
    } catch (error: any) {
      showToast({ message: error.message || '画像アップロードに失敗しました', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (!profile) {
    return <div className="p-4">ログインが必要です</div>
  }

  return (
    <div className="p-4 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold jp-text">プロフィール設定</h2>
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-600">
            プロフィール完成度: {completeness.percentage}%
          </div>
          <div className="w-20 h-2 bg-gray-200 rounded-full">
            <div
              className="h-2 bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${completeness.percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* 基本プロフィール */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5" />
          <h3 className="text-lg font-semibold">基本情報</h3>
        </div>

        <div className="space-y-4">
          {/* アバター */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={profile.avatar_url || '/default-avatar.png'}
                alt="プロフィール画像"
                className="w-20 h-20 rounded-full object-cover"
              />
              <label className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full p-1 cursor-pointer hover:bg-blue-700">
                <Camera className="w-3 h-3" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
            </div>
            <div>
              <div className="font-medium">{profile.display_name}</div>
              <div className="text-sm text-gray-600">プロフィール画像を変更</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">表示名 *</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full p-2 border rounded-md"
                placeholder="表示名を入力"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">電話番号</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2 border rounded-md"
                placeholder="090-1234-5678"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">自己紹介</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full p-2 border rounded-md"
              rows={3}
              placeholder="自己紹介を入力（任意）"
            />
            <div className="text-xs text-gray-500 mt-1">
              {bio.length}/500文字
            </div>
          </div>

          <button
            onClick={handleProfileUpdate}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? '更新中...' : 'プロフィールを更新'}
          </button>
        </div>
      </div>

      {/* アカウント設定 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5" />
          <h3 className="text-lg font-semibold">アカウント設定</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded-md"
              placeholder="email@example.com"
            />
            <div className="text-xs text-gray-500 mt-1">
              メールアドレス変更時は確認メールが送信されます
            </div>
          </div>

          <div>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="btn btn-outline"
            >
              パスワードを変更
            </button>
          </div>
        </div>
      </div>

      {/* 通知設定 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5" />
          <h3 className="text-lg font-semibold">通知設定</h3>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={notificationSettings.email_notifications}
              onChange={(e) => setNotificationSettings({
                ...notificationSettings,
                email_notifications: e.target.checked
              })}
            />
            <span>メール通知を受け取る</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={notificationSettings.order_updates}
              onChange={(e) => setNotificationSettings({
                ...notificationSettings,
                order_updates: e.target.checked
              })}
            />
            <span>注文状況の更新通知</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={notificationSettings.marketing_emails}
              onChange={(e) => setNotificationSettings({
                ...notificationSettings,
                marketing_emails: e.target.checked
              })}
            />
            <span>マーケティングメールを受け取る</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={notificationSettings.push_notifications}
              onChange={(e) => setNotificationSettings({
                ...notificationSettings,
                push_notifications: e.target.checked
              })}
            />
            <span>プッシュ通知を受け取る</span>
          </label>

          <button
            onClick={handleNotificationUpdate}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? '更新中...' : '通知設定を更新'}
          </button>
        </div>
      </div>

      {/* プライバシー設定 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5" />
          <h3 className="text-lg font-semibold">プライバシー設定</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">プロフィール公開設定</label>
            <select
              value={privacySettings.profile_visibility}
              onChange={(e) => setPrivacySettings({
                ...privacySettings,
                profile_visibility: e.target.value as any
              })}
              className="w-full p-2 border rounded-md"
            >
              <option value="public">公開</option>
              <option value="friends">フレンドのみ</option>
              <option value="private">非公開</option>
            </select>
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={privacySettings.show_purchase_history}
              onChange={(e) => setPrivacySettings({
                ...privacySettings,
                show_purchase_history: e.target.checked
              })}
            />
            <span>購入履歴を公開する</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={privacySettings.show_favorites}
              onChange={(e) => setPrivacySettings({
                ...privacySettings,
                show_favorites: e.target.checked
              })}
            />
            <span>お気に入りを公開する</span>
          </label>

          <button
            onClick={handlePrivacyUpdate}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? '更新中...' : 'プライバシー設定を更新'}
          </button>
        </div>
      </div>

      {/* 住所帳 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            <h3 className="text-lg font-semibold">住所帳</h3>
          </div>
          <button
            onClick={() => setShowAddressModal(true)}
            className="btn btn-outline btn-sm"
          >
            住所を追加
          </button>
        </div>

        <div className="space-y-3">
          {addresses.map((address) => (
            <div key={address.id} className="p-3 border rounded-md flex items-start justify-between">
              <div>
                <div className="font-medium">
                  {address.name}
                  {address.is_default && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      既定
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  〒{address.postal_code} {address.prefecture}{address.city} {address.address1} {address.address2}
                </div>
                {address.phone && (
                  <div className="text-sm text-gray-600">{address.phone}</div>
                )}
              </div>
              <button
                onClick={() => handleAddressDelete(address.id)}
                className="text-red-600 hover:text-red-800"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {addresses.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              住所が登録されていません
            </div>
          )}
        </div>
      </div>

      {/* パスワード変更モーダル */}
      {showPasswordModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowPasswordModal(false)}
          title="パスワード変更"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">新しいパスワード</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-2 border rounded-md"
                placeholder="8文字以上で入力"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">パスワード確認</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-2 border rounded-md"
                placeholder="同じパスワードを入力"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="btn btn-outline"
              >
                キャンセル
              </button>
              <button
                onClick={handlePasswordUpdate}
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? '更新中...' : 'パスワードを更新'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 住所追加モーダル */}
      {showAddressModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowAddressModal(false)}
          title="住所を追加"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                className="border rounded-md p-2"
                placeholder="氏名"
                value={newAddress.name}
                onChange={(e) => setNewAddress({...newAddress, name: e.target.value})}
              />
              <input
                className="border rounded-md p-2"
                placeholder="郵便番号"
                value={newAddress.postal_code}
                onChange={(e) => setNewAddress({...newAddress, postal_code: e.target.value})}
              />
              <input
                className="border rounded-md p-2"
                placeholder="都道府県"
                value={newAddress.prefecture}
                onChange={(e) => setNewAddress({...newAddress, prefecture: e.target.value})}
              />
              <input
                className="border rounded-md p-2"
                placeholder="市区町村"
                value={newAddress.city}
                onChange={(e) => setNewAddress({...newAddress, city: e.target.value})}
              />
              <input
                className="border rounded-md p-2 md:col-span-2"
                placeholder="住所1（番地等）"
                value={newAddress.address1}
                onChange={(e) => setNewAddress({...newAddress, address1: e.target.value})}
              />
              <input
                className="border rounded-md p-2 md:col-span-2"
                placeholder="住所2（建物名等）"
                value={newAddress.address2}
                onChange={(e) => setNewAddress({...newAddress, address2: e.target.value})}
              />
              <input
                className="border rounded-md p-2"
                placeholder="電話番号"
                value={newAddress.phone}
                onChange={(e) => setNewAddress({...newAddress, phone: e.target.value})}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newAddress.is_default}
                  onChange={(e) => setNewAddress({...newAddress, is_default: e.target.checked})}
                />
                <span>既定の住所に設定</span>
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowAddressModal(false)}
                className="btn btn-outline"
              >
                キャンセル
              </button>
              <button
                onClick={handleAddressAdd}
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? '追加中...' : '住所を追加'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}