export const BUSINESS_CONFIG = {
  fees: {
    platform_rate: 0.15, // 15%
    organizer_default_rate: 0.10, // 残額から10%
    payment_processing: 0.036, // 3.6%
    bank_transfer_fee: 250, // 円
  },
  payouts: {
    minimum_amount: 5000, // 円
    processing_day: 25, // 締め日
    payment_day: 10, // 翌月支払日
    hold_period_days: 7, // 返金対応期間
  },
  inventory: {
    default_max_sales: null as number | null, // 無制限
    lock_timeout_minutes: 5,
    limited_edition_threshold: 100,
  },
  rate_limits: {
    purchase: { count: 10, window: 3600 },
    vote: { count: 100, window: 86400 },
    gift: { count: 50, window: 3600 },
    upload: { count: 20, window: 86400 },
    api_general: { count: 1000, window: 3600 },
  },
  dynamic_pricing: {
    time_modifiers: {
      peak: { hours: [19, 20, 21], multiplier: 1.1 },
      off_peak: { hours: [3, 4, 5], multiplier: 0.95 },
    },
    event_boost: 1.2,
    new_user_discount: 0.85,
    bulk_discount: {
      3: 0.95,
      5: 0.9,
      10: 0.85,
    } as Record<number, number>,
  },
} as const

export type BusinessConfig = typeof BUSINESS_CONFIG

