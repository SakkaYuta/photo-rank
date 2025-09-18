export type AnalyticsEvent =
  | 'view_item_list'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'begin_checkout'
  | 'purchase'

export class Analytics {
  static track(event: AnalyticsEvent, params?: Record<string, any>) {
    try {
      const w = window as any
      if (Array.isArray(w.dataLayer)) {
        w.dataLayer.push({ event, ...params })
      } else if (typeof (w.gtag) === 'function') {
        w.gtag('event', event, params || {})
      } else {
        // fallback: console for dev
        if (import.meta.env.DEV) console.debug('[analytics]', event, params || {})
      }
    } catch (_) {
      // noop
    }
  }

  static trackPurchase(amount: number, items: Array<{ id: string; price: number; qty: number }>) {
    this.track('purchase', {
      value: amount,
      currency: 'JPY',
      items: items.map(it => ({ item_id: it.id, price: it.price, quantity: it.qty })),
    })
  }
}

