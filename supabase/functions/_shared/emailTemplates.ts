export type PurchaseItem = { title: string; price: number; qty?: number }

export function renderEmailLayout(title: string, body: string) {
  return `<!doctype html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      body{font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,"Noto Sans JP",sans-serif; background:#f6f7f9; color:#111827;}
      .container{max-width:600px;margin:24px auto;padding:0 16px}
      .card{background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px}
      .brand{font-weight:700;color:#2563eb}
      .muted{color:#6b7280;font-size:12px}
      .btn{display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px}
      .list{margin:16px 0;padding:0}
      .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f3f4f6}
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <div class="brand" style="margin-bottom:8px">Photo‑Rank</div>
        ${body}
        <div class="muted" style="margin-top:16px">このメールに心当たりがない場合は破棄してください。</div>
      </div>
      <div class="muted" style="text-align:center;margin-top:8px">© ${new Date().getFullYear()} Photo‑Rank</div>
    </div>
  </body>
  </html>`
}

export function renderPurchaseSuccessEmail(params: { amount: number; items?: PurchaseItem[]; orderNumber?: string }) {
  const { amount, items = [], orderNumber } = params
  const itemsHtml = items.length ? `
    <div class="list">
      ${items.map(it => `<div class="row"><span>${escapeHtml(it.title)}</span><span>¥${fmt(it.price)}${it.qty ? ` × ${it.qty}` : ''}</span></div>`).join('')}
    </div>
  ` : ''
  const body = `
    <h2 style="margin:0 0 8px">ご購入ありがとうございます！</h2>
    ${orderNumber ? `<p style="margin:0 0 6px">注文番号: <strong>${escapeHtml(orderNumber)}</strong></p>` : ''}
    ${itemsHtml}
    <p style="margin:12px 0 6px"><strong>合計: ¥${fmt(amount)}</strong></p>
    <p style="margin:0 0 12px">注文履歴から詳細をご確認いただけます。</p>
    <a href="${originUrl() }" class="btn">Photo‑Rank を開く</a>
  `
  return renderEmailLayout('ご購入ありがとうございます', body)
}

export function renderPaymentFailedEmail() {
  const body = `
    <h2 style="margin:0 0 8px">お支払いに失敗しました</h2>
    <p style="margin:0 0 12px">別のカードをご利用いただくか、しばらくしてから再度お試しください。</p>
    <a href="${originUrl() }" class="btn">Photo‑Rank を開く</a>
  `
  return renderEmailLayout('お支払いに失敗しました', body)
}

export function renderRefundEmail(amount: number) {
  const body = `
    <h2 style="margin:0 0 8px">返金手続きを行いました</h2>
    <p style="margin:0 0 12px">返金額: <strong>¥${fmt(amount)}</strong></p>
    <p class="muted">返金の反映まで数日かかる場合があります。</p>
  `
  return renderEmailLayout('返金手続きを行いました', body)
}

function fmt(n: number) { return Math.round(n).toLocaleString('ja-JP') }
function escapeHtml(s: string) { return s.replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] as string)) }
function originUrl() { return Deno.env.get('APP_ORIGIN') || 'https://example.com' }

