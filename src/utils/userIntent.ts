export type UserIntent = 'creator' | 'fan' | null

const USER_INTENT_KEY = 'photo_rank_user_intent'

export const userIntentUtils = {
  // ユーザーの意図を取得
  getUserIntent(): UserIntent {
    try {
      const stored = localStorage.getItem(USER_INTENT_KEY)
      return stored === 'creator' || stored === 'fan' ? stored : null
    } catch {
      return null
    }
  },

  // ユーザーの意図を保存
  setUserIntent(intent: UserIntent) {
    try {
      if (intent) {
        localStorage.setItem(USER_INTENT_KEY, intent)
      } else {
        localStorage.removeItem(USER_INTENT_KEY)
      }
    } catch {
      // localStorage が使えない場合は何もしない
    }
  },

  // 初回訪問かどうかをチェック
  isFirstVisit(): boolean {
    return this.getUserIntent() === null
  },

  // ユーザータイプから意図を推定
  inferIntentFromUserType(userType?: string): UserIntent {
    switch (userType) {
      case 'creator':
        return 'creator'
      case 'general':
      case 'buyer':
        return 'fan'
      default:
        return this.getUserIntent()
    }
  },

  // 有効な意図を取得（ログイン状態とlocalStorageを考慮）
  getEffectiveIntent(userType?: string): UserIntent {
    // ログイン済みの場合はユーザータイプを優先
    if (userType) {
      return this.inferIntentFromUserType(userType)
    }

    // 未ログインの場合はlocalStorageの値を使用
    return this.getUserIntent()
  },

  // 意図をクリア
  clearIntent() {
    this.setUserIntent(null)
  }
}