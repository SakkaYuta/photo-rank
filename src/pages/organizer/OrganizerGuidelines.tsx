import React from 'react'

const OrganizerGuidelines: React.FC = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">PhotoRank オーガナイザーガイドライン</h1>
      <p className="text-gray-700 mb-6">
        本ガイドラインは、株式会社Seai（以下「当社」）が別途定めるPhotoRankオーガナイザー規約に定める個別規約です。
        本ガイドラインに定めのない事項については、PhotoRankオーガナイザー規約その他の当社が定める利用条件に従うものとします。
      </p>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">オーガナイザー登録</h2>
        <p className="text-gray-700">
          本サービスを利用して所属クリエイターにオリジナルグッズを製作・販売させようとする事務所、団体、法人等は、オーガナイザーとして登録する必要があります。
        </p>

        <h3 className="text-lg font-semibold text-gray-900">登録申請</h3>
        <p className="text-gray-700">
          オーガナイザーになろうとする方は、PhotoRankオーガナイザー規約を承認の上、当社の定める手続きにより登録を申請し、当社の承諾を得なければならないものとします。
          登録は承認制です。申請受付後、<span className="font-medium">2週間以内</span>を目安に、登録可否をメールでご連絡します（審査状況により前後する場合があります）。
        </p>

        <h4 className="font-semibold text-gray-900">提出書類</h4>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>当社所定の申込書</li>
          <li>印鑑証明書（当社が認める場合は不要）</li>
          <li>商業登記簿謄本（法人の場合）</li>
          <li>反社会的勢力でないことの表明・確約書</li>
          <li>所属クリエイター一覧</li>
          <li>その他当社が定める書類</li>
        </ul>

        <h4 className="font-semibold text-gray-900">審査基準</h4>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>事業の継続性・安定性</li>
          <li>過去の取引実績</li>
          <li>コンプライアンス体制</li>
          <li>クリエイター管理体制</li>
        </ul>
        <p className="text-gray-700">
          当社は、登録申請の承諾をした場合でも、当該承諾を撤回することができるものとします。
        </p>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-gray-900">クリエイターアカウント管理</h2>
        <p className="text-gray-700">オーガナイザーは、所属クリエイターに対してクリエイターアカウントを付与することができます。</p>

        <h4 className="font-semibold text-gray-900">年齢制限</h4>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>18歳未満のクリエイターには保護者の同意が必要</li>
          <li>13歳未満の者にはアカウント付与不可</li>
        </ul>

        <h4 className="font-semibold text-gray-900">管理責任</h4>
        <p className="text-gray-700">
          オーガナイザーは所属クリエイターに本ガイドライン、利用規約を遵守させ、クリエイターによるグッズ製作・販売その他の行為についてすべて責任を負うものとします。
        </p>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-gray-900">グッズ製作・販売</h2>
        <h4 className="font-semibold text-gray-900">取扱可能商品</h4>
        <p className="text-gray-700">アパレル商品</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>Tシャツ、パーカー、トートバッグ等</li>
          <li>デザイン位置、サイズの規定遵守</li>
        </ul>
        <p className="text-gray-700">雑貨商品</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>マグカップ、スマホケース、アクリルスタンド等</li>
          <li>印刷可能範囲の確認必須</li>
        </ul>
        <p className="text-gray-700">写真商品</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>フォトプリント、ポスター、キャンバス等</li>
          <li>解像度300dpi以上推奨</li>
        </ul>

        <h4 className="font-semibold text-gray-900">禁止商品・デザイン</h4>
        <p className="text-gray-700">オーガナイザー等は、以下の商品・デザインを製作・販売することができません。</p>
        <p className="text-gray-700 font-medium">知的財産権侵害</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>他人の著作権、商標権、意匠権を侵害するもの</li>
          <li>無許可のキャラクター、ロゴ使用</li>
          <li>他社ブランドの模倣品</li>
        </ul>
        <p className="text-gray-700 font-medium">公序良俗違反</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>わいせつな表現を含むもの</li>
          <li>暴力、賭博、麻薬等を肯定・美化するもの</li>
          <li>差別的表現、ヘイトスピーチを含むもの</li>
          <li>未成年者に有害な内容</li>
        </ul>
        <p className="text-gray-700 font-medium">法令違反</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>薬機法、景品表示法等に違反する表記</li>
          <li>偽ブランド品、海賊版</li>
          <li>危険物、規制物質を含む商品</li>
        </ul>
        <p className="text-gray-700 font-medium">その他</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>当社サービスの信用を毀損するもの</li>
          <li>製造パートナーの規定に反するもの</li>
          <li>品質基準を満たさないデザイン</li>
        </ul>

        <h4 className="font-semibold text-gray-900">品質管理</h4>
        <p className="text-gray-700 font-medium">デザインデータ要件</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>解像度：300dpi以上（印刷用）</li>
          <li>カラーモード：CMYK推奨</li>
          <li>ファイル形式：AI, PSD, PNG, JPG</li>
          <li>文字のアウトライン化</li>
        </ul>
        <p className="text-gray-700 font-medium">製造品質基準</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>提携工場の品質基準準拠</li>
          <li>不良品発生時の迅速な対応</li>
          <li>顧客クレームへの適切な処理</li>
        </ul>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-gray-900">価格設定と販売管理</h2>
        <h4 className="font-semibold text-gray-900">価格設定</h4>
        <p className="text-gray-700 font-medium">最低価格の遵守</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>各商品カテゴリの最低販売価格を下回らない</li>
          <li>ダンピング行為の禁止</li>
        </ul>
        <p className="text-gray-700 font-medium">価格構成</p>
        <p className="text-gray-700">販売価格 = 製造原価 + クリエイターマージン + プラットフォーム手数料</p>
        <p className="text-gray-700 font-medium">ボリュームディスカウント / 共同購入システム</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>期間内の複数注文をまとめて割引適用</li>
          <li>最低注文数の設定と管理</li>
          <li>割引率の適切な設定（最大20%まで）</li>
        </ul>
        <p className="text-gray-700 font-medium">オーガナイザー特典</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>月間売上に応じた追加割引</li>
          <li>大口注文時の特別価格</li>
        </ul>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-gray-900">収益分配</h2>
        <h4 className="font-semibold text-gray-900">手数料体系</h4>
        <p className="text-gray-700 font-medium">プラットフォーム手数料</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>販売価格の30%（決済手数料込み）</li>
        </ul>
        <h4 className="font-semibold text-gray-900">支払い条件</h4>
        <p className="text-gray-700 font-medium">振込スケジュール</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>月末締め、翌月末払い</li>
          <li>最低振込金額：2,000円</li>
          <li>振込手数料：オーガナイザー負担</li>
        </ul>
        <p className="text-gray-700 font-medium">支払い方法</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>オーガナイザーの登録口座へ一括振込</li>
          <li>クリエイターへの分配はオーガナイザーが実施</li>
        </ul>
        <p className="text-gray-700 font-medium">支払い留保</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>規約違反時の支払い留保権</li>
          <li>不正行為調査中の一時停止</li>
        </ul>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-gray-900">データ管理と活用</h2>
        <h4 className="font-semibold text-gray-900">売上データ</h4>
        <p className="text-gray-700 font-medium">提供データ</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>商品別売上明細</li>
          <li>クリエイター別実績</li>
          <li>顧客属性（個人情報を除く）</li>
        </ul>
        <p className="text-gray-700 font-medium">利用制限</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>本サービス利用目的のみ使用可</li>
          <li>第三者への提供禁止</li>
          <li>競合サービスでの利用禁止</li>
        </ul>
        <h4 className="font-semibold text-gray-900">顧客情報</h4>
        <p className="text-gray-700 font-medium">個人情報保護</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>購入者の個人情報へのアクセス制限</li>
          <li>目的外利用の禁止</li>
          <li>漏洩時の報告義務</li>
        </ul>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-gray-900">コンプライアンス</h2>
        <h4 className="font-semibold text-gray-900">表示義務</h4>
        <p className="text-gray-700 font-medium">特定商取引法</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>販売者情報の明記</li>
          <li>返品・交換ポリシーの表示</li>
          <li>納期、送料の明確化</li>
        </ul>
        <p className="text-gray-700 font-medium">景品表示法</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>誇大広告の禁止</li>
          <li>優良誤認、有利誤認の防止</li>
          <li>適切な打消し表示</li>
        </ul>
        <h4 className="font-semibold text-gray-900">著作権管理</h4>
        <p className="text-gray-700 font-medium">権利処理</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>クリエイターの著作権確認</li>
          <li>第三者権利の事前クリア</li>
          <li>侵害申告への迅速な対応</li>
        </ul>
        <p className="text-gray-700 font-medium">ライセンス管理</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>使用許諾範囲の明確化</li>
          <li>二次利用の制限</li>
          <li>契約期間の管理</li>
        </ul>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-gray-900">クリエイター管理</h2>
        <h4 className="font-semibold text-gray-900">教育・指導</h4>
        <p className="text-gray-700 font-medium">必須研修</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>ガイドライン説明会の実施</li>
          <li>著作権研修の定期開催</li>
          <li>品質管理トレーニング</li>
        </ul>
        <h4 className="font-semibold text-gray-900">パフォーマンス管理</h4>
        <p className="text-gray-700 font-medium">KPI設定</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>月間最低売上目標</li>
          <li>品質スコアの維持</li>
          <li>顧客満足度の向上</li>
        </ul>
        <p className="text-gray-700 font-medium">改善指導</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>低パフォーマンスクリエイターへの指導</li>
          <li>スキルアップ支援</li>
          <li>必要に応じた契約見直し</li>
        </ul>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-gray-900">ユーザーサポート</h2>
        <h4 className="font-semibold text-gray-900">問い合わせ対応</h4>
        <p className="text-gray-700 font-medium">対応時間</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>営業日24時間以内の初回返答</li>
          <li>エスカレーション体制の構築</li>
          <li>FAQの整備と更新</li>
        </ul>
        <h4 className="font-semibold text-gray-900">クレーム処理</h4>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>初期対応はオーガナイザーが実施</li>
          <li>重大案件は当社へエスカレーション</li>
          <li>解決までのフォローアップ</li>
        </ul>
        <h4 className="font-semibold text-gray-900">品質保証</h4>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>不良品対応（交換・返金の迅速な処理）</li>
          <li>原因究明と再発防止</li>
          <li>製造パートナーとの連携</li>
        </ul>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-gray-900">ペナルティ</h2>
        <h4 className="font-semibold text-gray-900">違反時の措置</h4>
        <p className="text-gray-700 font-medium">段階的措置</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>口頭注意</li>
          <li>書面による警告</li>
          <li>一時的な販売停止（7〜30日）</li>
          <li>契約解除</li>
        </ul>
        <h4 className="font-semibold text-gray-900">重大違反の即時解除事由</h4>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>知的財産権の重大な侵害</li>
          <li>反社会的勢力との関係判明</li>
          <li>重大な法令違反</li>
          <li>当社への損害発生</li>
        </ul>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-gray-900">監査・報告</h2>
        <h4 className="font-semibold text-gray-900">定期監査</h4>
        <p className="text-gray-700 font-medium">実施頻度</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>四半期ごとの定期監査</li>
          <li>必要に応じた臨時監査</li>
        </ul>
        <p className="text-gray-700 font-medium">監査項目</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>販売商品の適正性</li>
          <li>価格設定の妥当性</li>
          <li>クリエイター管理状況</li>
          <li>顧客対応品質</li>
        </ul>
        <h4 className="font-semibold text-gray-900">報告義務</h4>
        <p className="text-gray-700 font-medium">月次報告</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>売上実績</li>
          <li>クリエイター稼働状況</li>
          <li>クレーム・トラブル事案</li>
        </ul>
        <p className="text-gray-700 font-medium">即時報告事項</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>重大なクレーム・事故</li>
          <li>法的紛争の発生</li>
          <li>メディア露出・炎上案件</li>
        </ul>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-gray-900">改定</h2>
        <p className="text-gray-700">
          本ガイドラインは予告なく変更される場合があります。重要な変更については、オーガナイザー管理ページおよび登録メールアドレスへ通知いたします。
        </p>
      </section>

      <section className="space-y-1 mt-6">
        <h2 className="text-xl font-semibold text-gray-900">附則</h2>
        <p className="text-gray-700">本ガイドラインは2025年○月○日制定および実施するものとします。</p>
        <p className="text-gray-700">最終更新日：2025年○月○日</p>
        <p className="text-gray-700">株式会社Seai / PhotoRank運営事務局</p>
        <p className="text-gray-700">オーガナイザーサポート：<a className="text-blue-600 underline" href="mailto:photorank@seai.co.jp">photorank@seai.co.jp</a></p>
      </section>
    </div>
  )
}

export default OrganizerGuidelines
