// 入力検証ユーティリティ
// any型の使用を排除し、型安全な検証を提供

import { z } from 'zod'

// 基本的な検証スキーマ
export const ValidationSchemas = {
  // ユーザー入力
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
  displayName: z.string().min(1, '表示名を入力してください').max(50, '表示名は50文字以内で入力してください'),

  // 製品関連
  productType: z.enum(['tshirt', 'hoodie', 'cap', 'mug', 'sticker', 'poster', 'tote_bag', 'phone_case', 'keychain', 'badge']),
  quantity: z.number().int().min(1, '数量は1以上で入力してください').max(10000, '数量は10,000以下で入力してください'),
  price: z.number().min(0, '価格は0以上で入力してください'),

  // パートナー関連
  partnerStatus: z.enum(['pending', 'approved', 'suspended']),
  notificationType: z.enum(['order_created', 'order_updated', 'order_cancelled', 'payment_received']),
  priority: z.enum(['high', 'normal', 'low']),

  // UUID検証
  uuid: z.string().uuid('有効なUUIDを入力してください'),

  // URL検証
  webhookUrl: z.string().url('有効なURLを入力してください').startsWith('https://', 'HTTPSのURLを入力してください'),

  // 日付検証
  dateISO: z.string().datetime('有効なISO日付形式で入力してください'),
}

// 複合オブジェクトの検証スキーマ
export const ObjectSchemas = {
  // 製造注文の作成
  createManufacturingOrder: z.object({
    partner_id: ValidationSchemas.uuid,
    product_type: ValidationSchemas.productType,
    quantity: ValidationSchemas.quantity,
    unit_price: ValidationSchemas.price,
    work_id: ValidationSchemas.uuid.optional(),
    notes: z.string().max(1000, 'メモは1000文字以内で入力してください').optional(),
  }),

  // パートナー通知の作成
  createPartnerNotification: z.object({
    partner_id: ValidationSchemas.uuid,
    notification_type: ValidationSchemas.notificationType,
    payload: z.record(z.string(), z.any()), // JSONBフィールド用
    priority: ValidationSchemas.priority.optional(),
  }),

  // 管理者通知の作成
  createAdminNotification: z.object({
    type: z.enum(['payment_failure', 'partner_approval_needed', 'system_error', 'security_alert', 'performance_warning', 'content_moderation']),
    severity: z.enum(['low', 'normal', 'high', 'critical']),
    title: z.string().min(1, 'タイトルを入力してください').max(200, 'タイトルは200文字以内で入力してください'),
    description: z.string().max(1000, '説明は1000文字以内で入力してください').optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),

  // 決済失敗ログ
  paymentFailure: z.object({
    user_id: ValidationSchemas.uuid.optional(),
    work_id: ValidationSchemas.uuid.optional(),
    payment_intent_id: z.string().optional(),
    error_code: z.string().optional(),
    error_message: z.string().max(500, 'エラーメッセージは500文字以内で入力してください').optional(),
    amount: z.number().int().min(0, '金額は0以上で入力してください').optional(),
  }),

  // Webhookイベント
  webhookEvent: z.object({
    stripe_event_id: z.string().min(1, 'Stripe Event IDを入力してください'),
    type: z.string().min(1, 'イベントタイプを入力してください'),
    payload: z.record(z.string(), z.any()),
    idempotency_key: z.string().optional(),
  }),
}

// 検証結果の型定義
export type ValidationResult<T> = {
  success: true
  data: T
} | {
  success: false
  error: string
  details: z.ZodError
}

// 汎用検証関数
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): ValidationResult<T> {
  try {
    const result = schema.parse(input)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = (error.issues && error.issues[0]) || undefined
      return {
        success: false,
        error: firstError?.message || '入力値が無効です',
        details: error
      }
    }
    return {
      success: false,
      error: '検証エラーが発生しました',
      details: error as z.ZodError
    }
  }
}

// 型安全なクエリパラメータ検証
export function validateQueryParams<T>(
  schema: z.ZodSchema<T>,
  params: URLSearchParams
): ValidationResult<T> {
  const obj: Record<string, string> = {}
  params.forEach((value, key) => {
    obj[key] = value
  })
  return validateInput(schema, obj)
}

// サニタイゼーション関数
export const sanitize = {
  // HTMLエスケープ
  html: (input: string): string => {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  },

  // SQLインジェクション対策（追加の安全対策として）
  sql: (input: string): string => {
    return input.replace(/['";\\]/g, '')
  },

  // ファイル名の安全化
  filename: (input: string): string => {
    return input.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 255)
  },

  // 数値への安全な変換
  toNumber: (input: unknown): number | null => {
    if (typeof input === 'number') return input
    if (typeof input === 'string') {
      const num = Number(input)
      return isNaN(num) ? null : num
    }
    return null
  },

  // 整数への安全な変換
  toInteger: (input: unknown): number | null => {
    const num = sanitize.toNumber(input)
    return num !== null ? Math.floor(num) : null
  },
}

// Rate limiting用のユーティリティ
export class RateLimiter {
  private requests: Map<string, number[]> = new Map()

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const requests = this.requests.get(identifier) || []

    // 古いリクエストを除去
    const validRequests = requests.filter(time => now - time < this.windowMs)

    if (validRequests.length >= this.maxRequests) {
      return false
    }

    validRequests.push(now)
    this.requests.set(identifier, validRequests)
    return true
  }

  getRemainingRequests(identifier: string): number {
    const now = Date.now()
    const requests = this.requests.get(identifier) || []
    const validRequests = requests.filter(time => now - time < this.windowMs)
    return Math.max(0, this.maxRequests - validRequests.length)
  }
}
