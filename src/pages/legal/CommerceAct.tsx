import React from 'react'
import { Building2, Mail, CreditCard, Clock, RefreshCw, Shield, Truck, AlertCircle } from 'lucide-react'

export function CommerceAct() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white rounded-lg shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">特定商取引法に基づく表記</h1>

          {/* 運営会社情報 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">運営会社</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-600">運営会社</dt>
                  <dd className="text-gray-900">株式会社Seai</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-600">サービス名</dt>
                  <dd className="text-gray-900">PhotoRank</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-600">所在地</dt>
                  <dd className="text-gray-900">〒150-0011 東京都渋谷区東3-13-11 A-PLACE恵比寿東 4階</dd>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-600">電話番号</dt>
                  <dd className="text-gray-900">※お問い合わせはメールにて承っております</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-600">事業者の電子メールアドレス</dt>
                  <dd className="text-gray-900">photorank@seai.co.jp</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-600">運営責任者</dt>
                  <dd className="text-gray-900">※運営責任者名</dd>
                </div>
              </div>
            </div>
          </div>

          {/* 手数料等 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-bold text-gray-900">手数料等</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">出品者</h3>
                <ul className="text-blue-800 space-y-1 text-sm">
                  <li>• 商品が売れた場合、各商品登録画面に記載の金額（税込）が販売委託手数料としてかかります</li>
                  <li>• 売上金のお振込時に銀行振込手数料がかかります</li>
                </ul>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">購入者</h3>
                <ul className="text-green-800 space-y-1 text-sm">
                  <li>• 各商品掲載画面に記載の金額（税込）となります</li>
                  <li>• 配送料は商品価格に含まれているか、別途記載しております</li>
                </ul>
              </div>
            </div>
          </div>

          {/* お支払い方法 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-bold text-gray-900">お支払い方法</h2>
            </div>

            <div className="space-y-6">
              <div className="bg-orange-50 p-4 rounded-lg">
                <h3 className="font-semibold text-orange-900 mb-2">出品者</h3>
                <p className="text-orange-800">銀行振込</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">購入者</h3>

                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">【オリジナルグッズの場合】</h4>
                    <div className="space-y-3">
                      <div>
                        <h5 className="font-medium text-blue-800">即時決済</h5>
                        <ul className="text-blue-700 text-sm space-y-1 mt-1">
                          <li>• クレジットカード（Visa、Mastercard、JCB、American Express、Diners Club、Discover）</li>
                          <li>• デビットカード</li>
                          <li>• デジタルウォレット（Apple Pay、Google Pay）</li>
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-medium text-blue-800">前払い決済</h5>
                        <ul className="text-blue-700 text-sm space-y-1 mt-1">
                          <li>• コンビニ決済（ファミリーマート、ローソン、ミニストップ、セイコーマート等）</li>
                          <li>• 銀行振込</li>
                        </ul>
                      </div>
                    </div>
                    <div className="mt-3 p-2 bg-blue-100 rounded text-sm text-blue-800">
                      <p>※すべてStripeの安全な決済システムを利用しています</p>
                      <p>※未成年の方がご利用の場合は、法定代理人の同意を得てご利用ください</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-2">【デジタルコンテンツの場合】</h4>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• クレジットカード（上記ブランド対応）</li>
                      <li>• デジタルウォレット（Apple Pay、Google Pay）</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* お支払い時期 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-6 h-6 text-yellow-600" />
              <h2 className="text-xl font-bold text-gray-900">お支払い時期</h2>
            </div>
            <div className="space-y-4">
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h3 className="font-semibold text-yellow-900 mb-2">出品者</h3>
                <p className="text-yellow-800">売上金振込時に手数料等を差し引いてお振込いたします</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3">購入者</h3>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-gray-800">クレジットカード・デビットカード・デジタルウォレット</h4>
                    <p className="text-gray-700 text-sm">決済完了時点</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800">コンビニ決済</h4>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• ご注文日から14日以内にお支払いください</li>
                      <li>• お支払い期限を過ぎた場合、自動的にキャンセルとなります</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800">銀行振込</h4>
                    <ul className="text-gray-700 text-sm space-y-1">
                      <li>• ご注文日から7日以内にお支払いください</li>
                      <li>• 振込手数料はお客様負担となります</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 役務の提供時期 */}
          <div className="mb-8">
            <div className="bg-purple-50 p-4 rounded-lg">
              <h2 className="text-xl font-bold text-gray-900 mb-2">役務の提供時期</h2>
              <p className="text-purple-800">毎月1日から末日</p>
            </div>
          </div>

          {/* 商品の引渡時期等 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Truck className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-bold text-gray-900">商品の引渡時期等</h2>
            </div>
            <div className="space-y-6">
              <div className="bg-indigo-50 p-4 rounded-lg">
                <h3 className="font-semibold text-indigo-900 mb-2">オリジナルグッズの場合</h3>
                <ul className="text-indigo-800 space-y-1 text-sm">
                  <li>• ご注文・決済確認後、3〜10営業日程度で発送いたします</li>
                  <li>• ※完全受注生産のため、繁忙期は最大20営業日程度かかる場合があります</li>
                  <li>• ※長期休暇、在庫状況により変更される場合があります</li>
                </ul>
                <div className="mt-3">
                  <h4 className="font-medium text-indigo-900">配送について</h4>
                  <ul className="text-indigo-700 text-sm space-y-1 mt-1">
                    <li>• 配送業者：佐川急便株式会社、ヤマト運輸株式会社</li>
                    <li>• 配送地域：日本国内限定</li>
                  </ul>
                </div>
              </div>
              <div className="bg-teal-50 p-4 rounded-lg">
                <h3 className="font-semibold text-teal-900 mb-2">デジタルコンテンツの場合</h3>
                <ul className="text-teal-800 space-y-1 text-sm">
                  <li>• 決済完了後、即時ダウンロード可能となります</li>
                  <li>• 無料コンテンツは、所定の手順後にダウンロード可能です</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 返品・キャンセル・交換 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <RefreshCw className="w-6 h-6 text-red-600" />
              <h2 className="text-xl font-bold text-gray-900">返品・キャンセル・交換</h2>
            </div>
            <div className="space-y-6">
              <div className="bg-red-50 p-4 rounded-lg">
                <h3 className="font-semibold text-red-900 mb-2">基本方針</h3>
                <ul className="text-red-800 space-y-1 text-sm">
                  <li>• お客様都合による返品・キャンセル・交換は承っておりません</li>
                  <li>• ご注文確定後30分以内に限り、マイページからキャンセル可能です</li>
                </ul>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <h3 className="font-semibold text-orange-900 mb-2">不良品対応</h3>
                <ul className="text-orange-800 space-y-1 text-sm">
                  <li>• 誤送・不良品等は商品到着後7日以内にメールでご連絡ください</li>
                  <li>• 事前連絡なしの返送はお受けできません</li>
                  <li>• お客様の元で生じた破損・汚れは対応対象外となります</li>
                </ul>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h3 className="font-semibold text-yellow-900 mb-2">ご注意事項</h3>
                <ul className="text-yellow-800 space-y-1 text-sm">
                  <li>• モニター環境により、実際の色味と異なる場合があります</li>
                  <li>• 製造ロットによる若干の個体差がある場合があります</li>
                  <li>• アパレル製品：寸法表より±2〜3cm程度の誤差</li>
                  <li>• バッグ・小物：寸法表より±5%程度の誤差</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 決済セキュリティ */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-bold text-gray-900">決済セキュリティ</h2>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">Stripeによる安全な決済</h3>
              <ul className="text-green-800 space-y-1 text-sm">
                <li>• PCI DSS Level 1準拠の最高水準のセキュリティ</li>
                <li>• お客様のカード情報は当社サーバーには保存されません</li>
                <li>• すべての決済情報はSSL/TLS暗号化により保護されます</li>
                <li>• 不正利用防止のため、Stripe Radarによる24時間監視</li>
              </ul>
            </div>
          </div>

          {/* プライバシー保護 */}
          <div className="mb-8">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h2 className="text-xl font-bold text-gray-900 mb-2">プライバシー保護</h2>
              <p className="text-blue-800">
                個人情報の取り扱いについては、
                <button
                  type="button"
                  className="underline font-medium text-blue-700 hover:text-blue-900"
                  onClick={() => import('@/utils/navigation').then(m => m.navigate('privacy'))}
                >
                  プライバシーポリシー
                </button>
                をご覧ください。
              </p>
            </div>
          </div>

          {/* 返金について */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-bold text-gray-900">返金について</h2>
            </div>
            <div className="space-y-4">
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-900 mb-2">返金が発生する場合</h3>
                <ul className="text-purple-800 space-y-1 text-sm">
                  <li>• 提携工場の責任による不良品で交換在庫がない場合</li>
                  <li>• システムエラーによる重複決済</li>
                </ul>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">返金方法と期間</h3>
                <ul className="text-gray-700 space-y-1 text-sm">
                  <li>• クレジットカード：5〜10営業日（カード会社経由）</li>
                  <li>• コンビニ決済・銀行振込：銀行振込で返金（返金手数料250円［税込275円］はお客様負担）</li>
                </ul>
              </div>
            </div>
          </div>

          {/* お問い合わせ */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">お問い合わせ</h2>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-blue-900">メールでのお問い合わせ</h3>
                  <p className="text-blue-800">photorank@seai.co.jp</p>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900">対応時間</h3>
                  <p className="text-blue-800">平日10:00〜17:00（土日祝日を除く）</p>
                  <p className="text-blue-700 text-sm">※お問い合わせは24時間受付しております</p>
                  <p className="text-blue-700 text-sm">※返信は1〜2営業日以内に行います</p>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900">お問い合わせフォーム</h3>
                  <p className="text-blue-800">[お問い合わせはこちら]</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CommerceAct
