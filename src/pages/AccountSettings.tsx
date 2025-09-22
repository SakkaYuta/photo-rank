import React, { useEffect, useState } from 'react'
import { Settings, CreditCard, Landmark, Bell, ShieldCheck, Home, User as UserIcon, Mail, AlertTriangle, Camera, Upload } from 'lucide-react'
import { ProfileService } from '@/services/profile.service'
import { AddressService, type UserAddress, type AddressInput } from '@/services/address.service'
import { APP_NAME } from '@/utils/constants'
import { useUserRole } from '@/hooks/useUserRole'
import { joinOrganizerWithCode } from '@/services/organizerService'
import { PayoutService } from '@/services/payout.service'
import { IdentityService } from '@/services/identity.service'
import { AccountExtraService } from '@/services/account-extra.service'
import { MfaService } from '@/services/mfa.service'

type TabKey = 'account' | 'payout' | 'card' | 'address' | 'notifications' | '2fa'

const AccountSettings: React.FC = () => {
  const [active, setActive] = useState<TabKey>('account')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <Settings className="w-5 h-5 text-blue-600" />
          <h1 className="text-2xl font-bold">設定</h1>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Side menu */}
        <aside className="md:col-span-1">
          <nav className="rounded-xl border bg-white p-2">
            <MenuItem icon={<UserIcon className='w-4 h-4' />} label="アカウント" active={active==='account'} onClick={() => setActive('account')} />
            <MenuItem icon={<Landmark className='w-4 h-4' />} label="振込先" active={active==='payout'} onClick={() => setActive('payout')} />
            <MenuItem icon={<CreditCard className='w-4 h-4' />} label="クレジットカード" active={active==='card'} onClick={() => setActive('card')} />
            <MenuItem icon={<Home className='w-4 h-4' />} label="住所" active={active==='address'} onClick={() => setActive('address')} />
            <MenuItem icon={<Bell className='w-4 h-4' />} label="通知" active={active==='notifications'} onClick={() => setActive('notifications')} />
            <MenuItem icon={<ShieldCheck className='w-4 h-4' />} label="二要素認証" active={active==='2fa'} onClick={() => setActive('2fa')} />
          </nav>
        </aside>

        {/* Content */}
        <section className="md:col-span-3 space-y-6">
          {active === 'account' && <AccountPanel />}
          {active === 'payout' && <PayoutPanel />}
          {active === 'card' && <CardPanel />}
          {active === 'address' && <AddressPanel />}
          {active === 'notifications' && <NotificationsPanel />}
          {active === '2fa' && <TwoFAPanel />}
        </section>
      </div>
    </div>
  )
}

function MenuItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left ${active ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}>
      {icon}
      <span>{label}</span>
    </button>
  )
}

function AccountPanel() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [profileImage, setProfileImage] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  // 追加フィールド
  const [newAccountName, setNewAccountName] = useState('')
  const [gender, setGender] = useState<'男性'|'女性'|'回答しない'|'その他'>('回答しない')
  const [birthday, setBirthday] = useState('') // YYYY-MM-DD
  const [reasons, setReasons] = useState<Record<string, boolean>>({
    create_sell: false,
    buy_others: false,
    self_buy: false,
  })
  // オーガナイザー所属（クリエイター向け）
  const { userType, userProfile } = useUserRole()
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)
  const currentOrganizerName = (userProfile as any)?.organizer_profile?.organization_name as string | undefined

  useEffect(() => {
    (async () => {
      try {
        const p = await ProfileService.getProfile()
        if (p) {
          setDisplayName(p.display_name || '')
          setEmail(p.email || '')
          setProfileImage(p.avatar_url || '')
        }
        // 追加情報（性別/生年月日/きっかけ）はSupabaseから取得
        try {
          const extra = await AccountExtraService.get()
          if (extra) {
            if (extra.gender) setGender(extra.gender as any)
            if (extra.birthday) setBirthday(extra.birthday)
            if (extra.reasons) setReasons(prev => ({ ...prev, ...extra.reasons! }))
          }
        } catch {}

        // プロフィール画像をローカルストレージから復元
        try {
          const savedImage = localStorage.getItem('profile_image')
          if (savedImage && !profileImage) {
            setProfileImage(savedImage)
          }
        } catch {}
      } catch {}
    })()
  }, [])

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください')
      return
    }

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('ファイルサイズは5MB以下にしてください')
      return
    }

    setUploadingImage(true)
    try {
      // Convert to base64 for demo purposes
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setProfileImage(result)
        localStorage.setItem('profile_image', result)
        setUploadingImage(false)
        alert('プロフィール画像をアップロードしました')
      }
      reader.readAsDataURL(file)
    } catch (e) {
      alert('画像のアップロードに失敗しました')
      setUploadingImage(false)
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const updateData: any = { display_name: newAccountName || displayName }
      if (newEmail && newEmail !== email) {
        updateData.email = newEmail
      }
      await ProfileService.updateProfile(updateData)

      // 追加情報はSupabaseに保存
      await AccountExtraService.upsert({ gender, birthday, reasons })

      if (newEmail && newEmail !== email) {
        alert('プロフィールを保存しました。新しいメールアドレスの確認メールを送信しました。')
      } else {
        alert('保存しました')
      }
    } catch (e) {
      alert('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border bg-white p-6 space-y-4">
      <h2 className="text-lg font-semibold mb-2">アカウント</h2>

      {/* プロフィール画像セクション */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden border-2 border-gray-300">
            {profileImage ? (
              <img
                src={profileImage}
                alt="プロフィール画像"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <Camera className="w-8 h-8" />
              </div>
            )}
          </div>
          {uploadingImage && (
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 mb-1">プロフィール画像</h3>
          <p className="text-sm text-gray-600 mb-3">JPG、PNG形式、5MB以下のファイルをアップロードできます</p>
          <div className="flex flex-wrap gap-2">
            <label className="btn btn-outline btn-sm cursor-pointer">
              <Upload className="w-4 h-4 mr-1" />
              画像をアップロード
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={uploadingImage}
              />
            </label>
            {profileImage && (
              <button
                className="btn btn-outline btn-sm text-red-600 hover:text-red-700"
                onClick={() => {
                  setProfileImage('')
                  localStorage.removeItem('profile_image')
                  alert('プロフィール画像を削除しました')
                }}
              >
                削除
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">アカウント名</label>
          <input className="w-full border rounded-md px-3 py-2 bg-gray-50" value={displayName} disabled />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">新しいアカウント名</label>
          <input className="w-full border rounded-md px-3 py-2" placeholder="例: YUKIJAPAN" value={newAccountName} onChange={(e)=>setNewAccountName(e.target.value)} />
        </div>
      </div>

      {/* メールアドレスセクション */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
          <Mail className="w-4 h-4" />
          メールアドレス
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">現在のメールアドレス</label>
            <input
              className="w-full border rounded-md px-3 py-2 bg-gray-50"
              value={email || '未設定'}
              disabled
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">新しいメールアドレス</label>
            <input
              type="email"
              className="w-full border rounded-md px-3 py-2"
              placeholder="新しいメールアドレスを入力"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          メールアドレスを変更する場合は、確認メールが送信されます。メール内のリンクをクリックして変更を完了してください。
        </p>
      </div>

      <div className="pt-4">
        <h3 className="font-semibold mb-2">アカウント情報</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">性別</label>
            <select className="w-full border rounded-md px-3 py-2" value={gender} onChange={(e)=>setGender(e.target.value as any)}>
              <option>女性</option>
              <option>男性</option>
              <option>その他</option>
              <option>回答しない</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">生年月日</label>
            <input type="date" className="w-full border rounded-md px-3 py-2" value={birthday} onChange={(e)=>setBirthday(e.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm text-gray-600 mb-2">{APP_NAME}をはじめたきっかけ（任意）</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reasons.create_sell} onChange={e=>setReasons({...reasons, create_sell: e.target.checked})} /> アイテムを作成・販売するため</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reasons.buy_others} onChange={e=>setReasons({...reasons, buy_others: e.target.checked})} /> 誰かのアイテムを購入するため</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reasons.self_buy} onChange={e=>setReasons({...reasons, self_buy: e.target.checked})} /> 自分のアイテムを作成して購入するため</label>
          </div>
          <p className="text-xs text-gray-500 mt-2">性別、生年月日、{APP_NAME}をはじめたきっかけは他のユーザーへ公開されることはありません。サービスの品質向上のために活用させていただきます。</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
        <button className="btn btn-outline" onClick={()=>alert('パスワード変更は近日対応予定です')}>パスワード変更</button>
      </div>

      {/* クリエイター: オーガナイザー所属 */}
      {userType === 'creator' && (
        <div className="mt-6 border-t pt-4 space-y-3">
          <h3 className="font-semibold">オーガナイザー所属</h3>
          {currentOrganizerName ? (
            <div className="p-3 rounded-md bg-green-50 border border-green-200 text-sm text-green-800">
              現在 <span className="font-medium">{currentOrganizerName}</span> に所属しています。
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm text-gray-600">招待コード</label>
              <div className="flex gap-2">
                <input className="border rounded-md px-3 py-2 font-mono tracking-widest" value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={6} />
                <button className="btn btn-primary" disabled={joining || inviteCode.length<6} onClick={async()=>{
                  setJoining(true)
                  try {
                    const res = await joinOrganizerWithCode(userProfile?.id as string, inviteCode)
                    if (res.success) { alert(`${res.organizerName} への参加申請が完了しました`) ; setInviteCode('') }
                    else { alert(res.message) }
                  } catch (e:any) {
                    alert(e?.message || '参加に失敗しました')
                  } finally { setJoining(false) }
                }}>{joining ? '参加中...' : '参加する'}</button>
              </div>
              <p className="text-xs text-gray-500">オーガナイザーから受け取った6桁の招待コードを入力してください</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 border-t pt-4">
        <h3 className="font-semibold mb-2">退会</h3>
        <p className="text-sm text-gray-600">
          {APP_NAME}を退会するには、登録されているメールアドレスでの本人確認が必要です。登録メールアドレス <span className="font-medium text-gray-900">{email || '未設定'}</span> に認証コード（または確認メール）を送信します。
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button className="btn btn-outline" onClick={()=>alert('認証コードを送信しました（デモ）')}>認証コードを送信</button>
          <button className="btn btn-danger" onClick={async()=>{ if(confirm('本当に退会しますか？この操作は取り消せません。')) { try { await ProfileService.deleteAccount(); alert('退会手続きが完了しました'); } catch (e) { alert('退会手続きに失敗しました'); } } }}>退会する</button>
        </div>
      </div>
    </div>
  )
}

function PayoutPanel() {
  const { userType, userProfile } = useUserRole()
  const organizer = userType === 'organizer' ? (userProfile as any)?.organizer_profile : null

  const [bank, setBank] = useState({
    bank_name: '',
    branch_code: '',
    account_number: '',
    account_type: '普通',
    account_holder_kana: '',
  })
  const [person, setPerson] = useState({
    last_name: '',
    first_name: '',
    last_name_kana: '',
    first_name_kana: '',
    birthday: '',
    postal_code: '',
    prefecture: '',
    city: '',
    address1: '',
    address2: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const acc = await PayoutService.get()
        if (acc) setBank({
          bank_name: acc.bank_name,
          branch_code: acc.branch_code,
          account_number: acc.account_number,
          account_type: acc.account_type,
          account_holder_kana: acc.account_holder_kana,
        })
      } catch {}
      try {
        const id = await IdentityService.get()
        if (id) setPerson({
          last_name: id.last_name,
          first_name: id.first_name,
          last_name_kana: id.last_name_kana,
          first_name_kana: id.first_name_kana,
          birthday: id.birthday?.slice(0,10) || '',
          postal_code: id.postal_code || '',
          prefecture: id.prefecture || '',
          city: id.city || '',
          address1: id.address1 || '',
          address2: id.address2 || '',
        })
      } catch {}
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const disabled = Boolean(organizer)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled) return
    setSaving(true)
    try {
      await PayoutService.upsert({
        bank_name: bank.bank_name,
        branch_code: bank.branch_code,
        account_number: bank.account_number,
        account_type: bank.account_type as any,
        account_holder_kana: bank.account_holder_kana,
      })
      await IdentityService.upsert({
        last_name: person.last_name,
        first_name: person.first_name,
        last_name_kana: person.last_name_kana,
        first_name_kana: person.first_name_kana,
        birthday: person.birthday,
        postal_code: person.postal_code,
        prefecture: person.prefecture,
        city: person.city,
        address1: person.address1,
        address2: person.address2,
      })
      alert('保存しました')
    } catch {
      alert('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold">銀行口座</h2>
        {disabled && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-5 h-5 mt-0.5" />
            <div className="text-sm">
              支払い口座はオーガナイザー支払いになっているため、オーガナイザーに確認ください。<br />
              {organizer?.organization_name ? (
                <span className="font-medium">オーガナイザー: {organizer.organization_name}（ID: {organizer.id}）</span>
              ) : (
                <span className="font-medium">オーガナイザーID: {organizer?.id}</span>
              )}
            </div>
          </div>
        )}
        <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">銀行名</label>
            <select className="w-full border rounded-md px-3 py-2" value={bank.bank_name} onChange={e=>setBank({...bank, bank_name: e.target.value})} disabled={disabled}>
              <option value="">銀行名を選択</option>
              <option>みずほ銀行</option>
              <option>三菱UFJ銀行</option>
              <option>三井住友銀行</option>
              <option>ゆうちょ銀行</option>
              <option>りそな銀行</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">支店コード</label>
            <input className="w-full border rounded-md px-3 py-2" placeholder="000" maxLength={3} value={bank.branch_code} onChange={e=>setBank({...bank, branch_code: e.target.value.replace(/[^0-9]/g,'').slice(0,3)})} disabled={disabled} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">口座番号</label>
            <input className="w-full border rounded-md px-3 py-2" placeholder="0000000" maxLength={7} value={bank.account_number} onChange={e=>setBank({...bank, account_number: e.target.value.replace(/[^0-9]/g,'').slice(0,7)})} disabled={disabled} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">口座種別</label>
            <select className="w-full border rounded-md px-3 py-2" value={bank.account_type} onChange={e=>setBank({...bank, account_type: e.target.value})} disabled={disabled}>
              <option>普通</option>
              <option>当座</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">口座名義 (カタカナ・半角英数字)</label>
            <input className="w-full border rounded-md px-3 py-2" placeholder="スリスリタロウ" value={bank.account_holder_kana} onChange={e=>setBank({...bank, account_holder_kana: e.target.value})} disabled={disabled} />
          </div>
          <div className="md:col-span-2 text-xs text-gray-500 space-y-1">
            <p>銀行口座はご本人名義の口座のみご利用いただけます。振込申請には本人情報のご登録もお願いいたします。</p>
            <p>ご入力いただいた情報は会員規約に従って、金融機関等に開示・提供することがあります。</p>
            <p>法人・任意団体・個人事業主の方は振込方法が異なりますので、口座登録のお手続きに関するFAQをご確認ください。</p>
            <p>適格請求書発行事業者登録番号の登録を希望される方は、インボイスに関するFAQをご確認ください。</p>
          </div>
          <div className="md:col-span-2 mt-2">
            <button className="btn btn-primary" disabled={disabled || saving}>{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold">本人情報</h2>
        <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">姓</label>
            <input className="w-full border rounded-md px-3 py-2" value={person.last_name} onChange={e=>setPerson({...person, last_name: e.target.value})} disabled={disabled} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">名</label>
            <input className="w-full border rounded-md px-3 py-2" value={person.first_name} onChange={e=>setPerson({...person, first_name: e.target.value})} disabled={disabled} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">セイ</label>
            <input className="w-full border rounded-md px-3 py-2" value={person.last_name_kana} onChange={e=>setPerson({...person, last_name_kana: e.target.value})} disabled={disabled} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">メイ</label>
            <input className="w-full border rounded-md px-3 py-2" value={person.first_name_kana} onChange={e=>setPerson({...person, first_name_kana: e.target.value})} disabled={disabled} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">生年月日</label>
            <input type="date" className="w-full border rounded-md px-3 py-2" value={person.birthday} onChange={e=>setPerson({...person, birthday: e.target.value})} disabled={disabled} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">郵便番号</label>
            <input className="w-full border rounded-md px-3 py-2" placeholder="123-4567" value={person.postal_code} onChange={e=>setPerson({...person, postal_code: e.target.value})} disabled={disabled} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">都道府県</label>
            <input className="w-full border rounded-md px-3 py-2" value={person.prefecture} onChange={e=>setPerson({...person, prefecture: e.target.value})} disabled={disabled} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">市区町村</label>
            <input className="w-full border rounded-md px-3 py-2" value={person.city} onChange={e=>setPerson({...person, city: e.target.value})} disabled={disabled} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">番地など</label>
            <input className="w-full border rounded-md px-3 py-2" value={person.address1} onChange={e=>setPerson({...person, address1: e.target.value})} disabled={disabled} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">建物名・部屋番号</label>
            <input className="w-full border rounded-md px-3 py-2" value={person.address2} onChange={e=>setPerson({...person, address2: e.target.value})} disabled={disabled} />
          </div>
          <div className="md:col-span-2">
            <button className="btn btn-primary" disabled={disabled || saving}>{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CardPanel() {
  return (
    <div className="rounded-xl border bg-white p-6 space-y-3">
      <h2 className="text-lg font-semibold">クレジットカード</h2>
      <p className="text-sm text-gray-600">カードの追加・削除は近日対応予定です。</p>
      <button className="btn btn-outline w-fit" onClick={()=>alert('近日対応予定です')}>カードを追加</button>
    </div>
  )
}

function AddressPanel() {
  const [list, setList] = useState<UserAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<AddressInput>({ name: '', postal_code: '', address1: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setList(await AddressService.list()) } finally { setLoading(false) }
  }
  useEffect(()=>{ load() }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await AddressService.create(form)
      setForm({ name: '', postal_code: '', address1: '' })
      await load()
    } catch (e) {
      alert('住所の保存に失敗しました')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-lg font-semibold mb-4">住所</h2>
        {loading ? (
          <div className="text-gray-500">読み込み中...</div>
        ) : (
          <div className="space-y-3">
            {list.length === 0 && <div className="text-gray-500">登録された住所はありません</div>}
            {list.map(addr => (
              <div key={addr.id} className="p-3 border rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{addr.name} {addr.is_default && <span className="ml-2 text-xs text-green-600">(既定)</span>}</div>
                    <div className="text-sm text-gray-600">〒{addr.postal_code} {addr.prefecture || ''}{addr.city || ''}{addr.address1} {addr.address2 || ''}</div>
                    {addr.phone && <div className="text-sm text-gray-600">TEL: {addr.phone}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h3 className="font-semibold mb-3">新しい住所を追加</h3>
        <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="border rounded-md px-3 py-2" placeholder="氏名" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} required />
          <input className="border rounded-md px-3 py-2" placeholder="郵便番号 (例: 100-0001)" value={form.postal_code} onChange={e=>setForm({...form, postal_code: e.target.value})} required />
          <input className="border rounded-md px-3 py-2" placeholder="都道府県" value={form.prefecture || ''} onChange={e=>setForm({...form, prefecture: e.target.value})} />
          <input className="border rounded-md px-3 py-2" placeholder="市区町村" value={form.city || ''} onChange={e=>setForm({...form, city: e.target.value})} />
          <input className="border rounded-md px-3 py-2 md:col-span-2" placeholder="住所1" value={form.address1} onChange={e=>setForm({...form, address1: e.target.value})} required />
          <input className="border rounded-md px-3 py-2 md:col-span-2" placeholder="住所2 (任意)" value={form.address2 || ''} onChange={e=>setForm({...form, address2: e.target.value})} />
          <input className="border rounded-md px-3 py-2" placeholder="電話番号 (任意)" value={form.phone || ''} onChange={e=>setForm({...form, phone: e.target.value})} />
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.is_default)} onChange={e=>setForm({...form, is_default: e.target.checked})} /> 既定の住所にする</label>
          <div className="md:col-span-2">
            <button className="btn btn-primary" disabled={saving}>{saving ? '保存中...' : '追加'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function NotificationsPanel() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState({ email_notifications: true, order_updates: true, marketing_emails: false, push_notifications: true })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await import('@/services/supabaseClient').then(m => m.supabase.auth.getUser())
        if (!user) { setLoading(false); return }
        const s = await ProfileService.getNotificationSettings(user.id)
        setSettings(s)
      } catch {}
      setLoading(false)
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await import('@/services/supabaseClient').then(m => m.supabase.auth.getUser())
      if (user) await ProfileService.updateNotificationSettings(user.id, settings)
      alert('保存しました')
    } catch {
      alert('保存に失敗しました')
    } finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl border bg-white p-6 space-y-4">
      <h2 className="text-lg font-semibold">通知</h2>
      {loading ? (
        <div className="text-gray-500">読み込み中...</div>
      ) : (
        <div className="space-y-3">
          <Toggle label="メール通知" checked={settings.email_notifications} onChange={(v)=>setSettings({...settings, email_notifications: v})} />
          <Toggle label="注文の更新" checked={settings.order_updates} onChange={(v)=>setSettings({...settings, order_updates: v})} />
          <Toggle label="マーケティングメール" checked={settings.marketing_emails} onChange={(v)=>setSettings({...settings, marketing_emails: v})} />
          <Toggle label="プッシュ通知" checked={settings.push_notifications} onChange={(v)=>setSettings({...settings, push_notifications: v})} />
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
        </div>
      )}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between border rounded-md px-3 py-2">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} />
    </label>
  )
}

function TwoFAPanel() {
  return (
    <div className="rounded-xl border bg-white p-6 space-y-3">
      <h2 className="text-lg font-semibold">二要素認証</h2>
      <p className="text-sm text-gray-600">アカウントの安全性を高めるため、二要素認証（2FA）の設定が可能になります。現在は準備中です。</p>
      <button className="btn btn-outline w-fit" onClick={()=>alert('近日対応予定です')}>有効化</button>
    </div>
  )
}

export default AccountSettings
