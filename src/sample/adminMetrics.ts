export const SAMPLE_ADMIN_METRICS = {
  todayRevenue: 128500,
  successRate: 97.4,
  expiredLocks: 0,
  recentErrors: [
    { id: 'e1', message: 'Webhook timeout (Stripe)', level: 'warning', time: new Date(Date.now()-3600000).toISOString() },
  ],
  daily: Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000)
    return { date: d.toISOString().slice(0,10), total_revenue: 100000 + i * 12500, total_purchases: 40 + i * 3 }
  })
}

