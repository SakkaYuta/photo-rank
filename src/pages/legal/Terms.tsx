import React from 'react'
import { Shield, User, AlertTriangle, CreditCard, Building2, Scale } from 'lucide-react'

export function Terms() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white rounded-lg shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">PhotoRank利用規約</h1>

          <div className="mb-8 p-4 bg-blue-50 rounded-lg">
            <p className="text-blue-900 text-sm leading-relaxed">
              株式会社Seai（以下「当社」）が運営する「PhotoRank」（以下「本サービス」）をご利用いただくお客様には、以下の利用規約（以下「本規約」）に従って本サービスをご利用いただきます。本サービスをご利用のお客様は、本規約の内容をご承諾いただいたものとみなしますので、ご了承ください。また本規約の他に本サービス内にて個別に記載する諸項目・規定等も、名目の如何にかかわらず本規約の一部を構成するものとします。
            </p>
          </div>

          {/* 第1条 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">第1条（サービス内容の変更）</h2>
            </div>
            <div className="space-y-3 text-gray-700">
              <p>1. 当社は、お客様に事前に通知することなくいつでもサービスの内容を変更、停止または中止することができるものとします。</p>
              <p>2. 当社は、本規約を予告なしに変更することがあります。改定後の本規約は遅滞なく本サービス内に表示しますので、最新の内容を常にご確認ください。</p>
            </div>
          </div>

          {/* 第2条 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <User className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-bold text-gray-900">第2条（会員登録について）</h2>
            </div>
            <div className="space-y-3 text-gray-700">
              <p>1. 会員登録フォームに、お客様ご自身に関する真実かつ正確なデータを入力のうえご登録ください。</p>
              <p>2. 会員登録データが、常に真実かつ正確な内容を反映するものであるように適宜修正してください。</p>
              <p>3. 法人や団体の場合、連絡の取れるご担当者様のお名前やご連絡先にてご登録ください。ご担当者様が変更になる際は必ずマイページより情報を更新願います。</p>
              <p>4. 反社会的勢力等（暴力団、暴力団員、右翼団体、反社会的勢力、その他これに準ずる者を意味します。以下同じ）である、または資金提供その他を通じて反社会的勢力等の維持、運営もしくは経営に協力もしくは関与する等反社会的勢力等との何らかの交流もしくは関与を行っている方は、会員登録はできません。</p>
              <p>5. 万一真実かつ正確なデータが提供されていないと本サービスが判断した場合には、当該会員のアカウントを停止または削除し、以降サービスを利用することをお断りすることがあります。</p>
            </div>
          </div>

          {/* 第3条 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-bold text-gray-900">第3条（アカウント管理）</h2>
            </div>
            <div className="space-y-3 text-gray-700">
              <p>1. 会員登録されている場合、そのメールアドレスおよびパスワードの管理はお客様の責任において行なってください。</p>
              <p>2. アカウントを利用して行われた行為の責任は、当該アカウントを保有しているお客様の責任とみなします。</p>
              <p>3. 許可なく自分のアカウントが利用された場合、またはパスワードが第三者に漏洩してしまった場合には、ただちに当社にご連絡ください。</p>
              <p>4. サービスのご利用を一時的に終了される際には、その都度ログアウトをしてください。</p>
              <p>5. アカウント情報の漏洩、不正使用などから損害が生じたとしても、当社に故意または重大な過失がある場合を除き、一切の責任を負いません。</p>
            </div>
          </div>

          {/* 第4条 */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">第4条（通知または連絡）</h2>
            <div className="text-gray-700">
              <p>当社が、お客様へ通知または連絡が必要であると判断した場合は、メール（photorank@seai.co.jp）および当社が適切と判断する手法を用いて行ないます。</p>
            </div>
          </div>

          {/* 第5条 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-bold text-gray-900">第5条（お客様の責務）</h2>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">知的財産権の遵守</h3>
                <div className="space-y-3 text-gray-700">
                  <p>1. お客様ご本人以外が作成したイラスト、漫画、写真、絵画、ロゴ、小説や歌詞等の文書等の創作物（以下「コンテンツ」）については、著作権、商標権等の知的財産権を有している第三者から許諾を得る必要があります。</p>
                  <p>2. お客様が本サービスを通じて提携工場に製作を依頼するコンテンツに関する責任は、お客様自身が負います。</p>
                  <p>3. 第三者が知的財産権を有するコンテンツについて、権利者の許諾なく使用した場合には、刑事罰、損害賠償請求、異議申し立て等を受ける可能性があることを十分ご理解ください。</p>
                  <p>4. 当社および提携工場は、お客様が依頼されるコンテンツの内容の信頼性、真実性、適法性を保証することは一切ありません。</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">プラットフォーム利用の理解</h3>
                <div className="space-y-3 text-gray-700">
                  <p>1. 本サービスは、お客様と提携工場をつなぐプラットフォームサービスであり、実際の製品製作は提携工場が行います。</p>
                  <p>2. 製品の品質、納期等については、各提携工場の基準に従うものとします。</p>
                </div>
              </div>
            </div>
          </div>

          {/* 第6条 */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">第6条（デザインツール・素材の利用）</h2>
            <div className="space-y-3 text-gray-700">
              <p>1. 本サービスで提供するデザインツール、スタンプ、テンプレート等は、本サービス内でのデザイン作成に限り無料でご利用いただけます。</p>
              <p>2. これらの素材を複製、模倣、加工して、本サービス以外で再配布・二次配布することは禁止します。</p>
              <p>3. 素材をそのまま利用した製品を販売することは禁止します。ただし、デザインの構成要素の一部として利用する場合は、この限りではありません。</p>
            </div>
          </div>

          {/* 第7条 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">第7条（ご注文・決済について）</h2>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">注文の承認</h3>
                <div className="space-y-3 text-gray-700">
                  <p>1. お客様が注文されるデザインの内容によっては、お申し込みをお受けしかねる場合があります。</p>
                  <p>2. 第三者の知的財産権の侵害のおそれがあることが判明した場合、当社は製作依頼を停止し、契約を解除することができます。</p>
                  <p>3. 未成年の方がお申し込みされる場合、親権者の同意が必要となります。</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">決済システム</h3>
                <div className="space-y-3 text-gray-700">
                  <p>1. 本サービスの決済は、Stripe社の決済システムを利用します。</p>
                  <p>2. お客様のカード情報等は、Stripeの安全な決済環境で処理され、当社のサーバーには保存されません。</p>
                  <p>3. 決済に関する詳細は、特定商取引法に基づく表記をご確認ください。</p>
                </div>
              </div>
            </div>
          </div>

          {/* 第8条 */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">第8条（製品について）</h2>
            <div className="space-y-3 text-gray-700">
              <p>1. お申込みのキャンセル・製品の返品・交換は原則として承っておりません（受注生産のため）。</p>
              <p>2. 到着した製品のサイズ・本体色・数量等がご注文内容と異なる場合は、未使用のまま到着から7日以内にご連絡ください。</p>
              <p>3. モニターやハードウェア・設定等の差異による色味の違いを理由とした返品・交換はお受けできません。</p>
              <p>4. 提携工場の製造過程における当社の責に帰すべき製品の不具合については、新しい製品と交換させていただきます。</p>
            </div>
          </div>

          {/* 第9条 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h2 className="text-xl font-bold text-gray-900">第9条（禁止事項）</h2>
            </div>
            <p className="text-gray-700 mb-3">お客様は、本サービスのご利用にあたり、以下の行為を行ってはならないものとします。</p>
            <div className="bg-red-50 p-4 rounded-lg">
              <ul className="space-y-2 text-red-800">
                <li>• 法令に違反する行為</li>
                <li>• 第三者の知的財産権等の権利を侵害する行為</li>
                <li>• 他人に経済的・精神的損害を与える行為</li>
                <li>• 脅迫、名誉毀損、プライバシー侵害、肖像権侵害等の行為</li>
                <li>• 猥褻・猥雑なもの、品性を欠くもの等を掲載、開示、提供または送付する行為</li>
                <li>• 民族的・人種的差別につながる行為</li>
                <li>• 未成年者を害するような行為</li>
                <li>• なりすまし行為</li>
                <li>• 本サービスの運営を妨害する行為</li>
                <li>• その他、本規約に反する行為</li>
              </ul>
            </div>
          </div>

          {/* 第10条 */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">第10条（禁止事項抵触による措置）</h2>
            <div className="space-y-3 text-gray-700">
              <p>1. ご入稿データが禁止事項に抵触するおそれがある場合、提携工場での製作を一時保留し確認させていただくことがあります。</p>
              <p>2. 確認に要した日数分、出荷日を延長させていただく場合があります。</p>
              <p>3. 確認の結果、ご注文が承れない場合は、キャンセル処理に関する事務手数料（1点につき220円税込）を頂戴いたします。</p>
            </div>
          </div>

          {/* 第11条 */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">第11条（アカウントの停止・削除）</h2>
            <div className="space-y-3 text-gray-700">
              <p>1. お客様が本規約に違反した場合、当社は当該アカウントを停止または削除することができます。</p>
              <p>2. 反社会的勢力に該当する場合は、会員登録の拒否、登録の抹消および注文情報の取り消しを行えるものとします。</p>
              <p>3. 当社は、アカウントの削除に際して、当該会員および第三者に対して一切責任を負わないものとします。</p>
            </div>
          </div>

          {/* 第12条 */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">第12条（個人情報の取り扱い）</h2>
            <div className="text-gray-700">
              <p>
                お客様より受領した個人情報は、当社が別途定める
                <button
                  type="button"
                  className="underline text-blue-700 hover:text-blue-900 font-medium"
                  onClick={() => import('@/utils/navigation').then(m => m.navigate('privacy'))}
                >
                  プライバシーポリシー
                </button>
                に従い、厳重に取り扱います。
              </p>
            </div>
          </div>

          {/* 第13条 */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">第13条（アップロードデータの取り扱い）</h2>
            <div className="space-y-3 text-gray-700">
              <p>1. 当社は、お客様がアップロードしたデザインを、ご注文以外の用途には一切使用いたしません。</p>
              <p>2. 当社および提携工場は、お客様から送信されたデータを保管する義務を負いません。</p>
              <p>3. 送信いただいたデータの元データはお客様ご自身で必ず保管してください。</p>
            </div>
          </div>

          {/* 第14条 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-gray-600" />
              <h2 className="text-xl font-bold text-gray-900">第14条（免責事項）</h2>
            </div>
            <div className="space-y-3 text-gray-700">
              <p>1. 当社は、本サービスの利用または利用不能により発生した損害について、当社に故意または重大な過失がある場合を除き、責任を負いません。</p>
              <p>2. 提携工場での製作遅延、品質問題等について、当社は仲介者として最善の対応をいたしますが、直接的な責任は負いません。</p>
              <p>3. 本サービスはプラットフォームサービスであり、実際の製品製作は提携工場が行うため、製造上の問題については提携工場の責任範囲となります。</p>
            </div>
          </div>

          {/* 第15条 */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">第15条（著作権等）</h2>
            <div className="space-y-3 text-gray-700">
              <p>1. 当社は第三者の知的財産権を尊重しており、お客様も同様に第三者の知的財産権を尊重するよう努めてください。</p>
              <p>2. ご入稿いただけるデザインデータは、お客様がオリジナルで作成されたものか、権利保有者に書面（メール含む）にて許可を受けているものに限ります。</p>
              <p>3. 権利侵害の申告があった場合、当社は事実関係を調査し、適切な対処を行います。</p>
            </div>
          </div>

          {/* 第16条 */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">第16条（製品の受取拒否）</h2>
            <div className="space-y-3 text-gray-700">
              <p>本サービスは受注生産のため、受取拒否や保管期限切れで返送された場合、以下の費用を請求させていただきます：</p>
              <div className="bg-yellow-50 p-4 rounded-lg ml-4">
                <ul className="space-y-1 text-yellow-800">
                  <li>• 製品代金（全額）</li>
                  <li>• 往復配送料</li>
                  <li>• 返品事務手数料（2,200円税込）</li>
                  <li>• その他実費</li>
                </ul>
              </div>
              <p>正当な理由なく受取を拒否される等、悪質と判断した場合、法的措置を検討することがあります。</p>
            </div>
          </div>

          {/* 第17条 */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">第17条（情報の開示）</h2>
            <div className="text-gray-700">
              <p>法令に従って要請されたとき、本規約遵守のため、第三者の権利保護のため、その他当社が必要と判断したときは、コンテンツおよび関連情報を保存または開示することができるものとします。</p>
            </div>
          </div>

          {/* 第18条 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Scale className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-bold text-gray-900">第18条（準拠法・裁判管轄）</h2>
            </div>
            <div className="space-y-3 text-gray-700">
              <p>1. 本規約の成立、効力、履行および解釈に関しては、日本法が適用されるものとします。</p>
              <p>2. 本サービスまたは本規約に関連して生じた紛争については、東京地方裁判所を第一審の専属管轄裁判所とします。</p>
            </div>
          </div>

          {/* 附則 */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="w-6 h-6 text-gray-600" />
              <h2 className="text-xl font-bold text-gray-900">附則</h2>
            </div>
            <div className="space-y-2 text-gray-700">
              <p>本規約は2025年○月○日より施行します。</p>
              <p>最終更新日：2025年○月○日</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Terms
