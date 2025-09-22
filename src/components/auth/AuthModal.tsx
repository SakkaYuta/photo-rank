import { useState } from 'react';
import { signInWithGoogle, signInWithDemo } from '../../services/auth.service';
import { UserType } from '../../types/user';
import { Users, Factory, Calendar, User } from 'lucide-react';

export function AuthModal({ onClose }: { onClose: () => void }) {
  const [selectedUserType, setSelectedUserType] = useState<UserType>('general');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);

  const userTypes = [
    {
      type: 'general' as UserType,
      label: '一般ユーザー',
      description: '作品を閲覧・購入したい方',
      icon: User,
      color: 'text-blue-600'
    },
    {
      type: 'creator' as UserType,
      label: 'クリエイター',
      description: '作品を投稿・販売したい方',
      icon: Users,
      color: 'text-purple-600'
    },
    {
      type: 'factory' as UserType,
      label: '工場・印刷業者',
      description: 'プリント製造を担当する方',
      icon: Factory,
      color: 'text-green-600'
    },
    {
      type: 'organizer' as UserType,
      label: 'オーガナイザー',
      description: 'イベントやクリエイターをマネジメントする方',
      icon: Calendar,
      color: 'text-orange-600'
    }
  ];

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithGoogle(selectedUserType);
      onClose();
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDemoSignIn = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithDemo(selectedUserType);
      onClose();
    } catch (error) {
      console.error('Demo login failed:', error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
        <h2 className="mb-6 text-xl font-semibold text-center">
          {isSignUpMode ? '新規会員登録' : 'ログイン'}
        </h2>

        <div className="mb-6">
          <h3 className="mb-4 text-sm font-medium text-gray-700 dark:text-gray-300">
            ユーザータイプを選択してください
          </h3>

          <div className="space-y-3">
            {userTypes.map((userType) => {
              const IconComponent = userType.icon;
              return (
                <label
                  key={userType.type}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedUserType === userType.type
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="userType"
                    value={userType.type}
                    checked={selectedUserType === userType.type}
                    onChange={(e) => setSelectedUserType(e.target.value as UserType)}
                    className="sr-only"
                  />
                  <IconComponent className={`w-5 h-5 mr-3 ${userType.color}`} />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {userType.label}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {userType.description}
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 ${
                    selectedUserType === userType.type
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  }`}>
                    {selectedUserType === userType.type && (
                      <div className="w-full h-full rounded-full bg-white scale-50"></div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400 text-center">
          {userTypes.find(ut => ut.type === selectedUserType)?.label}として
          Googleアカウントで{isSignUpMode ? '登録します' : 'ログインします'}
        </p>

        <div className="space-y-3">
          <div className="flex justify-end gap-3">
            <button
              className="btn btn-outline"
              onClick={onClose}
              disabled={isLoggingIn}
            >
              キャンセル
            </button>
            <button
              className="btn btn-primary flex items-center gap-2"
              onClick={handleGoogleSignIn}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ログイン中...
                </>
              ) : (
                `Googleで${isSignUpMode ? '登録' : 'ログイン'}`
              )}
            </button>
          </div>

          {/* デモモードボタン */}
          <div className="text-center border-t pt-3">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              または
            </p>
            <button
              className="btn btn-outline w-full"
              onClick={handleDemoSignIn}
              disabled={isLoggingIn}
            >
              デモモードで体験
            </button>
          </div>
        </div>

        {/* ログイン/新規登録モード切り替え */}
        <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          {isSignUpMode ? (
            <>
              すでにアカウントをお持ちですか？{' '}
              <button
                onClick={() => setIsSignUpMode(false)}
                className="text-blue-600 hover:underline"
              >
                ログインはこちら
              </button>
            </>
          ) : (
            <>
              新規会員登録がまだの方は{' '}
              <button
                onClick={() => setIsSignUpMode(true)}
                className="text-blue-600 hover:underline"
              >
                こちら
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

