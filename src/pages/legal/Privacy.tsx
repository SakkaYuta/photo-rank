import React from 'react'

export function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white rounded-lg shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">プライバシーポリシー</h1>

          <div className="space-y-4 text-gray-700">
            <h2 className="text-xl font-semibold text-gray-900">個人情報保護方針</h2>
            <p>
              株式会社Seai（以下「当社」という。）は、お客様の個人情報保護の重要性を強く認識し、お客様との信頼関係を構築・維持するため、以下の通りプライバシーポリシーを定め、全社を挙げてお客様の個人情報の適切な保護に努めます。
            </p>
            <div className="text-sm text-gray-800">
              <p>〒150-0011</p>
              <p>東京都渋谷区東3-13-11 A-PLACE恵比寿東 4階</p>
              <p>株式会社Seai</p>
              <p>代表取締役</p>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">目次</h2>
            <ol className="list-decimal pl-6 space-y-1 text-gray-700">
              <li><a href="#law" className="text-blue-600 hover:underline">法令等の遵守</a></li>
              <li><a href="#definition" className="text-blue-600 hover:underline">個人情報の定義</a></li>
              <li><a href="#purpose" className="text-blue-600 hover:underline">個人情報の利用目的について</a></li>
              <li><a href="#within-purpose" className="text-blue-600 hover:underline">利用目的の範囲内での利用</a></li>
              <li><a href="#retention" className="text-blue-600 hover:underline">保存期間</a></li>
              <li><a href="#security" className="text-blue-600 hover:underline">個人情報の安全管理措置について</a></li>
              <li><a href="#supervision" className="text-blue-600 hover:underline">従業者の監督について</a></li>
              <li><a href="#third-parties" className="text-blue-600 hover:underline">個人情報の第三者提供・共同利用について</a></li>
              <li><a href="#related-info" className="text-blue-600 hover:underline">個人関連情報について</a></li>
              <li><a href="#pseudonymized" className="text-blue-600 hover:underline">仮名加工情報について</a></li>
              <li><a href="#anonymized" className="text-blue-600 hover:underline">匿名加工情報について</a></li>
              <li><a href="#improvement" className="text-blue-600 hover:underline">継続的改善</a></li>
              <li><a href="#disclosure" className="text-blue-600 hover:underline">個人データ等の開示、内容の訂正、追加又は削除等について</a></li>
              <li><a href="#contact" className="text-blue-600 hover:underline">個人情報に関するお問い合わせ</a></li>
              <li><a href="#changes" className="text-blue-600 hover:underline">プライバシーポリシーの変更について</a></li>
              <li><a href="#site-handling" className="text-blue-600 hover:underline">サイトで取得する情報の取扱い</a></li>
            </ol>
          </div>

          <div id="law" className="mt-10 space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">1. 法令等の遵守</h2>
            <p className="text-gray-700">
              当社は、個人情報の取扱いについて、「個人情報の保護に関する法律」（平成十五年法律第五十七号）、「電気通信事業法」（昭和五十九年法律第八十六号）、その他個人情報保護関連法令及びガイドライン、またこのプライバシーポリシーを遵守します。
            </p>
          </div>

          <div id="definition" className="mt-8 space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">2. 個人情報の定義</h2>
            <p className="text-gray-700">
              個人情報とは、生存する個人に関する情報であって、当該情報に含まれる氏名、生年月日、住所、電話番号、その他の記述等により特定の個人を識別することができるものをいいます。これには他の情報と照合することができ、それにより特定の個人を識別できるものを含みます。
            </p>
          </div>

          <div id="purpose" className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">3. 個人情報の利用目的について</h2>
            <p className="text-gray-700">
              当社では、個人情報の取得に際しては、本プライバシーポリシー内または各サービスのウェブサイト内若しくはアプリケーション内において、あらかじめ利用目的をできる限り特定した上で公表します。また、公表した利用目的にしたがって個人情報を取り扱います。
            </p>
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">当社サービスをご利用いただいた方の個人情報の利用目的</h3>
              <h4 className="font-medium text-gray-900">サービス提供に関する利用目的</h4>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>PhotoRankおよび当社が提供する各サービスの提供、管理、運営のため</li>
                <li>利用規約、利用料金表に基づいた各サービスの利用料金または商品代金のご請求のため</li>
                <li>ご注文商品の製作、発送、配送手配のため</li>
                <li>提携工場への製作指示、品質管理のため</li>
              </ul>
              <h4 className="font-medium text-gray-900">契約・手続きに関する利用目的</h4>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>サービスに関する契約のお申し込み、退会、ご登録情報変更、ご契約更新・継続のご案内および確認手続きのため</li>
                <li>ご本人確認、認証サービスのため</li>
              </ul>
              <h4 className="font-medium text-gray-900">カスタマーサポートに関する利用目的</h4>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>お問い合わせに関する内容確認、調査、ご返信のため</li>
                <li>障害情報、メンテナンス情報等技術的なサポートに関する情報のご提供のため</li>
                <li>商品の不良対応、返品・交換処理のため</li>
              </ul>
              <h4 className="font-medium text-gray-900">マーケティング・サービス改善に関する利用目的</h4>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>新サービス、新商品、機能改善等お客様に有用と思われる情報の告知、広告、宣伝、ダイレクトメールの送付、お電話によるご紹介等、サービスに関する各種ご提案のため</li>
                <li>キャンペーン、アンケート、モニター等の実施のため</li>
                <li>商品や景品、プレゼント等の発送のため</li>
                <li>ご登録いただいた個人情報を元に、個人として特定できない範囲において統計情報として集計し、サービス開発の参考資料とするため</li>
              </ul>
              <h4 className="font-medium text-gray-900">その他の利用目的</h4>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>お客様の意思により関連する機能を利用する際の参照のため</li>
                <li>お客様本人からあらかじめ同意を得ている場合に、個人情報を第三者に提供するため</li>
                <li>各サービスの提供に当たり利用目的を公表の上、同意をいただいた利用目的のため</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">当社への採用応募者の個人情報の利用目的</h3>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>応募歴の確認、履歴書・職務経歴書等個人情報記載事項をもとにした選考のため</li>
                <li>面接日時、採用不採用等合否のご連絡のため</li>
                <li>採用後の賃金決定、雇用管理のため</li>
                <li>ご本人から同意を得た利用目的のため</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">お取引先様の個人情報の利用目的</h3>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>お取引先様としての登録、契約管理のため</li>
                <li>業務上必要な連絡、商談、契約の履行のため</li>
                <li>法令に基づくコンプライアンス遵守のため</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">当社の株主様の個人情報の利用目的</h3>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>株主様の法律に基づく権利の行使への対応や、当社の義務の履行のため</li>
                <li>株主優待制度等、株主様としての地位に対する便宜の供与のため</li>
                <li>法令に基づく株主様のデータ管理のため</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">グループ会社との共同利用に関する利用目的</h3>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Seaiグループに所属する企業および団体との共同利用のため（詳細は「8. 個人情報の第三者提供・共同利用について」参照）</li>
                <li>グループ全体でのサービス向上、新サービス開発のため</li>
              </ul>
            </div>
          </div>

          <div id="within-purpose" className="mt-8 space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">4. 利用目的の範囲内での利用</h2>
            <p className="text-gray-700">
              当社は、あらかじめ特定し公表した利用目的の達成に必要な範囲内でのみお客様の個人情報を取り扱います。但し、以下の各号に該当する場合は、予め特定し公表した利用目的の達成に必要な範囲を超えてお客様の個人情報を取り扱うことがあります。
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>法令に基づく場合</li>
              <li>人の生命、身体又は財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき</li>
              <li>公衆衛生の向上又は児童の健全な育成の推進のために特に必要がある場合であって、本人の同意を得ることが困難であるとき</li>
              <li>国の機関若しくは地方公共団体又はその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合であって、本人の同意を得ることにより当該事務の遂行に支障を及ぼすおそれがあるとき</li>
              <li>学術研究機関等に個人データを提供する場合であって、当該学術研究機関等が当該個人データを学術研究目的で取り扱う必要があるとき</li>
            </ul>
          </div>

          <div id="retention" className="mt-8 space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">5. 保存期間</h2>
            <p className="text-gray-700">
              当社は、利用目的に必要な範囲内でお客様の個人情報の保存期間を定め、保存期間経過後又は利用目的達成後はお客様の個人情報を遅滞なく消去いたします。但し、以下の各号に該当する場合はこの限りではありません。
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>法令の規定に基づき、保存しなければならないとき</li>
              <li>本人の同意があるとき</li>
              <li>当社が自己の業務の遂行に必要な限度で個人情報を保存する場合であって、当該個人情報を消去しないことについて相当な理由があるとき</li>
              <li>当該個人情報を消去しないことについて特別の理由があるとき</li>
            </ul>
          </div>

          <div id="security" className="mt-8 space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">6. 個人情報の安全管理措置について</h2>
            <p className="text-gray-700">
              お客様よりお預かりした個人情報は、組織的、物理的、人的、技術的施策を講じることで個人情報への不正な侵入、個人情報の紛失、破壊、改ざん、及び漏えい等を防止いたします。
            </p>
            <h3 className="font-medium text-gray-900">具体的な安全管理措置</h3>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>SSL/TLS暗号化通信の実装</li>
              <li>アクセス権限の厳格な管理</li>
              <li>定期的なセキュリティ監査の実施</li>
              <li>従業員へのセキュリティ教育の実施</li>
              <li>Stripeなど外部決済サービスを利用したカード情報の非保持化</li>
            </ul>
          </div>

          <div id="supervision" className="mt-8 space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">7. 従業者の監督について</h2>
            <p className="text-gray-700">
              個人情報の取り扱いに関する内部規程類を明確化し、適切に個人情報を取り扱うよう従業者を監督いたします。また、定期的な研修を実施し、個人情報保護の重要性について周知徹底を図ります。
            </p>
          </div>

          <div id="third-parties" className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">8. 個人情報の第三者提供・共同利用について</h2>
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900">I. 第三者提供について</h3>
              <p className="text-gray-700">
                お客様よりお預かりした個人情報は、お客様本人の同意を得ずに第三者に提供することは、原則いたしません。但し以下の場合は、関係法令に反しない範囲で、お客様本人の同意なくお客様の個人情報を提供することがあります。
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>法令に基づく場合</li>
                <li>人の生命、身体又は財産の保護のために必要がある場合であって、お客様本人の同意を得ることが困難であるとき</li>
                <li>公衆衛生の向上又は児童の健全な育成の推進のために特に必要がある場合であって、お客様本人の同意を得ることが困難であるとき</li>
                <li>国の機関若しくは地方公共団体又はその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合であって、お客様本人の同意を得ることにより当該事務の遂行に支障を及ぼすおそれがあるとき</li>
                <li>当該第三者が学術研究機関等である場合であって、当該第三者が当該個人データを学術研究目的で取り扱う必要があるとき</li>
                <li>当社が利用目的の達成に必要な範囲内において個人データの取扱いの全部又は一部を委託している業者（提携工場、配送業者、決済代行業者等）に対して当該個人データを開示・提供する場合</li>
                <li>合併その他の事由による事業の承継に伴って個人データが提供される場合</li>
                <li>特定の者との間で共同して利用される場合（詳細は以下II参照）</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900">II. 共同利用について</h3>
              <p className="text-gray-700">当社は、以下に公表する場合に、お客様よりお預かりした個人情報を共同利用いたします。</p>
              <div>
                <h4 className="font-medium text-gray-900">共同利用する者の範囲</h4>
                <p className="text-gray-700">Seaiグループに所属する企業および団体（当社の親会社、子会社、関連会社を含む）</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">利用目的</h4>
                <p className="text-gray-700">「3. 個人情報の利用目的について」において定める利用目的の範囲</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">共同利用する個人情報の項目</h4>
                <p className="text-gray-700">氏名、住所、電子メールアドレス、電話番号、契約情報、その他の上記の利用目的に必要な範囲の項目</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">管理責任者</h4>
                <div className="text-gray-700 text-sm">
                  <p>〒150-0011 東京都渋谷区東3-13-11 A-PLACE恵比寿東 4階</p>
                  <p>株式会社Seai 代表取締役</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900">III. 第三者提供の確認及び記録</h3>
              <p className="text-gray-700">当社は、個人データの第三者提供および第三者からの提供を受ける際は、法令に基づき適切な確認・記録を行います。</p>
            </div>
          </div>

          <div id="related-info" className="mt-8 space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">9. 個人関連情報について</h2>
            <div>
              <h3 className="font-medium text-gray-900">個人関連情報を第三者から提供を受けて個人データとして取得する場合</h3>
              <p className="text-gray-700">当社は、個人関連情報（生存する個人に関する情報であって、個人情報、匿名加工情報及び仮名加工情報のいずれにも該当しないもの）を第三者から提供を受けて個人データとして取得する場合には、法令に基づき適切な対応を行います。</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">第三者に個人関連情報を提供する場合</h3>
              <p className="text-gray-700">当社は、第三者に個人関連情報を提供する場合には、法令に基づき、提供先において本人の同意が得られていることを確認した上で提供いたします。</p>
            </div>
          </div>

          <div id="pseudonymized" className="mt-8 space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">10. 仮名加工情報について</h2>
            <p className="text-gray-700">当社は、仮名加工情報を作成・利用する場合には、法令で定める基準に従って適正な加工を施し、安全管理措置を講じます。</p>
          </div>

          <div id="anonymized" className="mt-8 space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">11. 匿名加工情報について</h2>
            <p className="text-gray-700">当社は、匿名加工情報を作成する場合には、法令で定める基準に従って適正な加工を施し、作成した匿名加工情報に含まれる情報の項目を公表いたします。</p>
          </div>

          <div id="improvement" className="mt-8 space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">12. 継続的改善</h2>
            <p className="text-gray-700">当社は、個人情報の取り扱いを適切なものとするよう、継続的な改善を実施します。</p>
          </div>

          <div id="disclosure" className="mt-8 space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">13. 個人データ等の開示、内容の訂正、追加又は削除等について</h2>
            <div>
              <h3 className="font-medium text-gray-900">各サービスでの個人データ開示・訂正・削除の方法</h3>
              <p className="text-gray-700">PhotoRankおよび当社が提供する各サービスでは、マイページにログインすることで、お預かりした個人情報の閲覧、訂正が可能です。</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">開示請求等の手続き</h3>
              <p className="text-gray-700">お客様本人が個人情報の利用目的の通知、個人情報の開示、訂正、追加、削除、利用の停止又は第三者への提供の停止を希望される場合、以下の手続きに従ってご請求ください。</p>
              <h4 className="font-medium text-gray-900 mt-2">請求方法</h4>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>本人確認書類をご準備ください</li>
                <li>お問い合わせフォームまたはメールにてご連絡ください</li>
                <li>合理的な範囲内で速やかに対応いたします</li>
              </ul>
              <h4 className="font-medium text-gray-900 mt-2">ご注意事項</h4>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>本人又は第三者の生命、身体、財産その他の権利利益を害するおそれがある場合</li>
                <li>当社の業務の適正な実施に著しい支障を及ぼすおそれがある場合</li>
                <li>他の法令に違反することとなる場合</li>
              </ul>
            </div>
          </div>

          <div id="contact" className="mt-8 space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">14. 個人情報に関するお問い合わせ</h2>
            <p className="text-gray-700">当社は個人情報の取り扱いに関するお客様からの苦情その他のお問い合わせについて迅速かつ適切に対応いたします。</p>
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-gray-700"><span className="font-medium">メールアドレス：</span><a className="text-blue-600 hover:underline" href="mailto:photorank@seai.co.jp">photorank@seai.co.jp</a></p>
              <p className="text-gray-700"><span className="font-medium">対応時間：</span>平日10:00〜17:00（土日祝日を除く）</p>
            </div>
          </div>

          <div id="changes" className="mt-8 space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">15. プライバシーポリシーの変更について</h2>
            <p className="text-gray-700">当社では、取得する個人情報の変更、利用目的の変更、またはその他プライバシーポリシーの変更を行う際は、当ページの変更をもって公表とさせていただきます。変更後のプライバシーポリシーはサイト上に改定日を表示した時点より効力を生じます。</p>
          </div>

          <div id="site-handling" className="mt-10 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">サイトで取得する情報の取扱い</h2>
            <div>
              <h3 className="font-medium text-gray-900">Cookie（クッキー）の使用について</h3>
              <p className="text-gray-700">当社は、よりよいサービスの提供を目的としてCookieを使用しています。Cookieにより、お客様の行動履歴や閲覧履歴などの情報を収集することがありますが、これらの情報はお客様個人を特定することのできる情報ではございません。</p>
              <p className="text-gray-700">Cookieの送受信を希望されない場合は、ブラウザの設定を変更することにより、Cookieの送受信を拒否または削除することができます。</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">アクセスログについて</h3>
              <p className="text-gray-700">当社のサイトではアクセスされた方の情報をアクセスログとして記録しています。アクセスログには、IPアドレス、ホスト名、ブラウザ・OSの種類、アクセス日時などの情報が含まれます。これらはサイトの保守管理や利用状況に関する統計分析のために活用いたします。</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">第三者サービスの利用について</h3>
              <p className="text-gray-700">当社は、サービスの品質向上のため、以下の第三者サービスを利用しています：</p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Google Analytics（アクセス解析）</li>
                <li>Stripe（決済処理）</li>
                <li>その他マーケティングツール</li>
              </ul>
              <p className="text-gray-700">これらのサービスは独自にCookieを使用して情報を収集する場合があります。</p>
            </div>
          </div>

          <div className="mt-10 space-y-1 text-gray-700">
            <h3 className="font-medium text-gray-900">（付則）</h3>
            <p>本プライバシーポリシーは 2025年9月29日 制定及び実施するものとします。</p>
            <p>最終更新日：2025年9月29日</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Privacy
