import React from 'react'

export function PaymentMethods() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white rounded-lg shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">お支払い方法について</h1>

          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 mb-8">
              当サイトでは、Stripeの安全な決済システムを通じて、クレジットカード、デビットカード、デジタルウォレット、コンビニ決済、銀行振込など、多様なお支払い方法をご利用いただけます。
            </p>

            <h2 className="text-xl font-bold text-gray-900 mb-4">ご利用可能な決済方法</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-bold text-blue-900 mb-2">即時決済</h3>
                <ul className="text-blue-800 space-y-1">
                  <li>• クレジットカード・デビットカード</li>
                  <li>• デジタルウォレット（Apple Pay、Google Pay）</li>
                </ul>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-bold text-green-900 mb-2">前払い決済</h3>
                <ul className="text-green-800 space-y-1">
                  <li>• コンビニ決済</li>
                  <li>• 銀行振込</li>
                </ul>
              </div>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-4">クレジットカード・デビットカード</h2>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">対応ブランド</h3>
            <p className="text-gray-700 mb-4">
              Visa、Mastercard、American Express、JCB、Diners Club、Discoverの各種カードがご利用いただけます。
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">ご利用の流れ</h3>
            <ol className="list-decimal list-inside text-gray-700 mb-4 space-y-1">
              <li>ご注文時に「クレジットカード」を選択</li>
              <li>Stripeの安全な決済画面でカード情報を入力</li>
              <li>決済完了後、すぐに注文確定・製作開始</li>
            </ol>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">セキュリティについて</h3>
            <ul className="list-disc list-inside text-gray-700 mb-4 space-y-1">
              <li><strong>PCI DSS準拠</strong>：業界最高水準のセキュリティ基準に準拠</li>
              <li><strong>3Dセキュア認証</strong>：不正利用を防ぐための本人認証サービス</li>
              <li><strong>カード情報の非保持</strong>：お客様のカード情報は当社サーバーには保存されません</li>
              <li><strong>暗号化通信</strong>：すべての決済情報はSSL/TLS暗号化により保護されます</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">ご注意事項</h3>
            <ul className="list-disc list-inside text-gray-700 mb-6 space-y-1">
              <li>一括払いのみのお取り扱いとなります</li>
              <li>ご注文者様と異なる名義のカードはご利用いただけません</li>
              <li>カード会社の利用限度額をご確認ください</li>
              <li>決済エラーが発生した場合は、カード会社にお問い合わせください</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mb-4">デジタルウォレット</h2>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">Apple Pay / Google Pay</h3>
            <p className="text-gray-700 mb-4">
              スマートフォンやタブレットから、ワンタッチで安全にお支払いいただけます。
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">ご利用の流れ</h3>
            <ol className="list-decimal list-inside text-gray-700 mb-4 space-y-1">
              <li>決済画面で「Apple Pay」または「Google Pay」のボタンを選択</li>
              <li>デバイスで認証（Face ID、Touch ID、パスコード）</li>
              <li>即座に決済完了</li>
            </ol>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">対応デバイス</h3>
            <ul className="list-disc list-inside text-gray-700 mb-6 space-y-1">
              <li><strong>Apple Pay</strong>：iPhone、iPad、Mac（Safari使用時）</li>
              <li><strong>Google Pay</strong>：Android端末、Chrome ブラウザ</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mb-4">コンビニ決済</h2>
            <p className="text-gray-700 mb-4">
              全国の主要コンビニエンスストア（ファミリーマート、ローソン、ミニストップ、セイコーマート等、34,000店舗以上）でお支払いいただけます。
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">ご利用の流れ</h3>
            <ol className="list-decimal list-inside text-gray-700 mb-4 space-y-1">
              <li>ご注文時に「コンビニ決済」を選択</li>
              <li>お支払い番号をメールまたは画面で確認</li>
              <li>選択したコンビニで14日以内にお支払い</li>
              <li>入金確認後、製作開始</li>
            </ol>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">ご注意事項</h3>
            <ul className="list-disc list-inside text-gray-700 mb-6 space-y-1">
              <li>30万円を超えるご注文にはご利用いただけません</li>
              <li>お支払い期限は14日間です</li>
              <li>入金確認は営業日のみ行います</li>
              <li>当日出荷をご希望の場合は、13時までに入金確認が必要です</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mb-4">銀行振込</h2>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">ご利用条件</h3>
            <p className="text-gray-700 mb-4">税込5,500円以上のご注文でご利用可能</p>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">ご利用の流れ</h3>
            <ol className="list-decimal list-inside text-gray-700 mb-4 space-y-1">
              <li>ご注文時に「銀行振込」を選択</li>
              <li>振込先情報をメールでお送りします</li>
              <li>7日以内に指定口座へお振込み</li>
              <li>入金確認後、製作開始</li>
            </ol>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">ご注意事項</h3>
            <ul className="list-disc list-inside text-gray-700 mb-6 space-y-1">
              <li>振込手数料はお客様負担となります</li>
              <li>振込人名義の前に必ず注文番号をご入力ください</li>
              <li>複数注文をまとめてお振込みの場合は、すべての注文番号をご入力ください</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mb-4">返金・キャンセルについて</h2>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">クレジットカード・デビットカード</h3>
            <ul className="list-disc list-inside text-gray-700 mb-4 space-y-1">
              <li>返金処理は5-10営業日程度かかります</li>
              <li>カード会社の締日により、翌月以降の返金となる場合があります</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">コンビニ決済・銀行振込</h3>
            <ul className="list-disc list-inside text-gray-700 mb-6 space-y-1">
              <li>返金手数料として250円（税込275円）がかかります</li>
              <li>銀行口座への振込で返金いたします</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mb-4">セキュリティ対策</h2>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">Stripe Radar（不正利用防止）</h3>
            <p className="text-gray-700 mb-4">
              機械学習により、リアルタイムで不正な取引を検知・ブロックします。
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">データ保護</h3>
            <ul className="list-disc list-inside text-gray-700 mb-6 space-y-1">
              <li>すべての決済データは暗号化されて送信されます</li>
              <li>PCI DSS Level 1認証取得済み</li>
              <li>お客様のカード情報は当社には保存されません</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mb-4">よくあるご質問</h2>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Q: 分割払いは利用できますか？</h4>
                <p className="text-gray-700">A: 申し訳ございませんが、現在は一括払いのみの対応となっております。</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Q: 決済がエラーになりました。どうすればよいですか？</h4>
                <p className="text-gray-700">A: カードの有効期限、利用限度額、セキュリティコードをご確認ください。問題が解決しない場合は、カード会社にお問い合わせください。</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Q: 領収書は発行されますか？</h4>
                <p className="text-gray-700">A: ご注文完了後、メールにて電子領収書をお送りします。マイページからもダウンロード可能です。</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Q: 海外発行のカードは使えますか？</h4>
                <p className="text-gray-700">A: ご利用いただけます。ただし、為替レートによる差額が生じる場合があります。</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Q: セキュリティコード（CVV/CVC）とは何ですか？</h4>
                <p className="text-gray-700">A: カード裏面に記載されている3桁（American Expressは表面4桁）の数字です。カードの不正利用を防ぐためのセキュリティコードです。</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Q: 注文後に支払い方法を変更できますか？</h4>
                <p className="text-gray-700">A: 決済完了前であれば変更可能です。決済完了後の変更はできませんので、一度キャンセルして再注文をお願いします。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaymentMethods