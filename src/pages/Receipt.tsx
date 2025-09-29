import React from 'react'
import { FileText, Download, Mail, CreditCard, Store, Building2 } from 'lucide-react'

export function Receipt() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white rounded-lg shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">領収書発行について</h1>

          {/* 電子領収書の自動発行 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">電子領収書の自動発行</h2>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-blue-900">
                Stripe決済をご利用の場合、決済完了時に自動的に電子領収書（レシート）がご登録のメールアドレスに送信されます。
              </p>
            </div>
          </div>


          {/* ご注意事項 */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">ご注意事項</h2>

            <div className="space-y-4">
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h3 className="font-semibold text-yellow-900 mb-2">商品への同梱について</h3>
                <p className="text-yellow-800">
                  お届けする商品に領収書や納品書は同梱されません。
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">決済完了メールの保管</h3>
                <p className="text-gray-700">
                  Stripeから自動送信される決済完了メール（レシート）も正式な領収書としてご利用いただけます。
                </p>
              </div>


              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">領収書の形式</h3>
                <p className="text-gray-700">
                  電子領収書（PDF形式）での発行となります。原本が必要な場合は、PDFを印刷してご利用ください。
                </p>
              </div>
            </div>
          </div>

          {/* コンビニ決済・銀行振込の場合 */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">コンビニ決済・銀行振込の場合</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Store className="w-5 h-5 text-orange-600" />
                  <h3 className="font-semibold text-orange-900">コンビニ決済</h3>
                </div>
                <p className="text-orange-800">
                  コンビニエンスストアで発行される「払込受領証」が領収書の代わりとなります。
                </p>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-purple-900">銀行振込</h3>
                </div>
                <p className="text-purple-800">
                  金融機関が発行する「振込明細書」が領収書の代わりとなります。
                </p>
              </div>
            </div>

          </div>

          {/* よくあるご質問 */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">よくあるご質問</h2>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Q: 領収書はいつ発行されますか？</h4>
                <p className="text-gray-700">
                  A: Stripe決済の場合、決済完了時にメールで自動送信されます。コンビニ決済・銀行振込の場合は、各支払い先で発行される受領証が領収書となります。
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Q: 電子領収書を紛失しました</h4>
                <p className="text-gray-700">
                  A: Stripeから送信される決済完了メールをご確認ください。メールを削除された場合は、お問い合わせください。
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Q: 会社名での領収書が必要です</h4>
                <p className="text-gray-700">
                  A: Stripeの電子領収書には決済時の名義が表示されます。会社名が必要な場合は、決済時に会社名でご注文ください。
                </p>
              </div>
            </div>
          </div>

          {/* お問い合わせボタン */}
          <div className="mt-8 flex justify-center">
            <a
              href="mailto:photorank@seai.co.jp"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Mail className="w-5 h-5" />
              領収書についてお問い合わせ
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Receipt