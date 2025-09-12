export const BUSINESS_CONFIG = {
  fees: {
    platform_rate: 0.30, // 30%（v3.1確定）
    bank_transfer_fee: 250, // 円（v3.1確定）
  },
  payouts: {
    minimum_amount: 5000, // 円（v3.1確定）
    schedule: 'EOM+2M', // 月末締め・翌々月末払い（表現用）
  },
  inventory: {
    default_max_sales: null as number | null, // 無制限
    lock_timeout_minutes: 5,
    limited_edition_threshold: 100,
  },
  rate_limits: {
    upload: { count: 20, window: 86400 },
    api_general: { count: 1000, window: 3600 },
  },
} as const

export type BusinessConfig = typeof BUSINESS_CONFIG
