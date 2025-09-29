import React from 'react'
import { AlertCircle, Clock, Package, RefreshCw, Shield, Truck } from 'lucide-react'

export function Refunds() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white rounded-lg shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">注文内容の変更および返品・交換について</h1>

          {/* 基本方針 */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">基本方針</h2>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-blue-900">
                当プラットフォームでは、お客様のご注文を提携工場へ送信し、オーダーメイドで製作を行っております。そのため、ご注文確定後30分を経過した場合のキャンセル、およびお客様都合による返品・交換は原則お受けできません。
              </p>
              <p className="text-blue-900 mt-2">
                製品の品質には万全を期しておりますが、万一不良品が届いた場合は、速やかに交換・返金対応をさせていただきます。
              </p>
            </div>
          </div>

          {/* デザインの変更について */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-bold text-gray-900">デザインの変更について</h2>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg mb-4">
              <h3 className="font-semibold text-orange-900 mb-2">ご注文確定前に必ずご確認ください</h3>
              <ul className="text-orange-800 space-y-1">
                <li>• デザインデータは提携工場へ直接送信されるため、ご注文確定後の差し替えや変更はできません</li>
                <li>• 仕上がりシミュレーションで最終確認を行ってからご注文ください</li>
                <li>• 入稿データの修正や色補正は行っておりません</li>
              </ul>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">データ入稿時のご注意</h3>
              <ul className="text-gray-700 space-y-1">
                <li>• デザインガイドの規定に沿ってご入稿ください</li>
                <li>• 規定外のデータの場合、追加作業費が発生する場合があります</li>
                <li>• データ不備により再入稿が必要な場合、出荷日が変更となります</li>
                <li>• 入稿規定に沿わないデータによる仕上がり不良は、返品・交換対象外となります</li>
              </ul>
            </div>
          </div>

          {/* ご注文後の変更・キャンセル */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-bold text-gray-900">ご注文後の変更・キャンセル</h2>
            </div>

            <div className="space-y-6">
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-gray-900 mb-2">30分以内のキャンセル</h3>
                <p className="text-gray-700">
                  ご注文完了後30分以内：マイページ【ご注文履歴】から無料でキャンセル可能
                </p>
              </div>

              <div className="border-l-4 border-yellow-500 pl-4">
                <h3 className="font-semibold text-gray-900 mb-2">30分経過後のキャンセル</h3>
                <ul className="text-gray-700 space-y-1">
                  <li>• 原則キャンセル不可（提携工場での製作が開始されるため）</li>
                  <li>• 製作開始前の場合のみ：事務手数料220円（税込）/1点でキャンセル可能</li>
                  <li>• 出荷日の前倒しができないことを理由としたキャンセルは不可</li>
                </ul>
              </div>

              <div className="border-l-4 border-red-500 pl-4">
                <h3 className="font-semibold text-gray-900 mb-2">変更不可項目</h3>
                <p className="text-gray-700 mb-2">ご注文確定後は以下の変更ができません：</p>
                <ul className="text-gray-700 space-y-1">
                  <li>• アイテムの種類・サイズ・カラー</li>
                  <li>• 数量の増減</li>
                  <li>• デザインの差し替え</li>
                  <li>• お届け先の変更（転送サービスをご利用ください）</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 商品到着後の返品・交換 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <RefreshCw className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-bold text-gray-900">商品到着後の返品・交換</h2>
            </div>

            <div className="space-y-6">
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-900 mb-2">返品・交換をお受けする場合</h3>
                <p className="text-purple-800 mb-2">以下の条件をすべて満たす場合に限り、返品・交換を承ります：</p>
                <ul className="text-purple-800 space-y-1">
                  <li>• 当プラットフォームまたは提携工場の責任による不良（品違い・破損・汚れ・印刷不良）</li>
                  <li>• 商品到着後7日以内のご連絡</li>
                  <li>• 未使用・未洗濯の状態</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">返品・交換の手順</h3>
                <div className="space-y-3">
                  <div className="border-l-4 border-purple-500 pl-4">
                    <h4 className="font-semibold text-gray-900">STEP 1</h4>
                    <p className="text-gray-700">商品到着後7日以内にお問い合わせフォームからご連絡</p>
                  </div>
                  <div className="border-l-4 border-purple-500 pl-4">
                    <h4 className="font-semibold text-gray-900">STEP 2</h4>
                    <p className="text-gray-700">返品承認のご連絡をお待ちください（事前連絡なしの返送は受付不可）</p>
                  </div>
                  <div className="border-l-4 border-purple-500 pl-4">
                    <h4 className="font-semibold text-gray-900">STEP 3</h4>
                    <p className="text-gray-700">承認後、着払いにて下記住所へご返送ください</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-100 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-900">返送先</h3>
                </div>
                <div className="text-gray-700">
                  <p>〒150-0011</p>
                  <p>東京都渋谷区東3-13-11</p>
                  <p>A-PLACE恵比寿東 4階</p>
                  <p>株式会社Seai 返送品受付センター</p>
                  <p className="text-sm text-red-600 mt-2">
                    ※送り状の品名欄に「注文番号」を必ずご記載ください
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 品質に関する重要事項 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">品質に関する重要事項</h2>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <p className="text-blue-900 mb-3">
                当プラットフォームでは複数の提携工場で製作を行っているため、以下の点についてご理解ください：
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">色味について</h3>
                <ul className="text-gray-700 text-sm space-y-1">
                  <li>• モニター環境により実物と色味が異なる場合があります</li>
                  <li>• 製造ロットにより若干の色味の違いが生じる場合があります</li>
                </ul>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">サイズについて</h3>
                <ul className="text-gray-700 text-sm space-y-1">
                  <li>• アパレル製品：寸法表より±2〜3cm程度の誤差</li>
                  <li>• バッグ・小物：寸法表より±5%程度の誤差</li>
                  <li>• 上記範囲内の誤差は良品として扱われます</li>
                </ul>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">個体差について</h3>
                <ul className="text-gray-700 text-sm space-y-1">
                  <li>• 生地の厚み、質感、風合いに若干の個体差があります</li>
                  <li>• 同一商品を複数ご注文の場合でも、完全に同一にならない場合があります</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 返金について */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Package className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-bold text-gray-900">返金について</h2>
            </div>

            <div className="space-y-6">
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">返金が発生する場合</h3>
                <ul className="text-green-800 space-y-1">
                  <li>• 不良品で交換商品の在庫がない場合</li>
                  <li>• 提携工場での製作ミスが確認された場合</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">返金の流れ</h3>
                <div className="space-y-3">
                  <div className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-semibold text-gray-900">STEP 1</h4>
                    <p className="text-gray-700">不良品の返送・確認（お客様→当社）</p>
                  </div>
                  <div className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-semibold text-gray-900">STEP 2</h4>
                    <p className="text-gray-700">提携工場での不良確認（1〜3営業日）</p>
                  </div>
                  <div className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-semibold text-gray-900">STEP 3</h4>
                    <p className="text-gray-700">返金処理の実行</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">返金方法と期間</h3>
                <ul className="text-gray-700 space-y-1">
                  <li>• クレジットカード：カード会社経由で返金（5〜10営業日）</li>
                  <li>• コンビニ決済：銀行振込で返金（店頭返金不可）</li>
                  <li>• 銀行振込：ご指定口座へ返金</li>
                </ul>
                <p className="text-sm text-gray-600 mt-2">※返金時期は決済方法により異なります</p>
              </div>
            </div>
          </div>

          {/* お問い合わせ */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">お問い合わせ</h2>
            <p className="text-gray-700 mb-4">
              ご不明な点がございましたら、お気軽にお問い合わせください。
            </p>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">カスタマーサポート</h3>
              <ul className="text-blue-800 space-y-1">
                <li>• 受付時間：平日10:00〜17:00（土日祝休）</li>
                <li>• お問い合わせフォーム：24時間受付</li>
                <li>• 返信目安：1〜2営業日以内</li>
              </ul>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-700 text-center">
                提携工場との連携により高品質な製品をお届けできるよう努めております。<br />
                ご理解とご協力をお願いいたします。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Refunds