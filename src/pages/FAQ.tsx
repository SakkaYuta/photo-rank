import React, { useState } from 'react'
import { Search, ChevronRight, HelpCircle, Package, ShoppingCart, Users, Star, Settings, MessageCircle, Shield, CreditCard, Truck, UserPlus, FileText } from 'lucide-react'

interface FAQItem {
  id: string
  question: string
  answer: string
}

interface FAQCategory {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  items: FAQItem[]
}

const faqCategories: FAQCategory[] = [
  {
    id: 'registration-sales',
    title: 'アイテムの登録・販売について',
    icon: Package,
    items: [
      {
        id: 'sales-flow',
        question: 'アイテムの販売の流れを教えて',
        answer: 'PhotoRankでのアイテム販売は以下の流れになります。\n1. クリエイター登録を行う\n2. 作品をアップロードする\n3. 商品を選択し、価格を設定する\n4. 販売開始\n5. 注文が入ると自動で製造・発送されます'
      },
      {
        id: 'sales-cost',
        question: 'アイテムの販売って料金がかかるの？',
        answer: '登録料や月額費用は一切かかりません。商品が売れた時のみ、原価と手数料が差し引かれます。初期費用0円で始められます。'
      }
    ]
  },
  {
    id: 'purchase',
    title: 'アイテムの購入について',
    icon: ShoppingCart,
    items: [
      {
        id: 'shipping-cost',
        question: '送料はいくらかかりますか？',
        answer: '送料は配送先・商品・提携工場の条件により異なります。\n・カートで自動計算される送料をご確認ください\n・送料無料の条件は現在設定していません\n・複数商品の同梱は条件により可能です'
      },
      {
        id: 'shipping-time',
        question: '注文後商品どのぐらいで発送されるか教えて',
        answer: '通常、ご注文から3〜10営業日で発送いたします。\n・受注生産のため、お時間をいただいております\n・繁忙期は最大で20営業日程度かかる場合があります\n・発送時にはメールでお知らせします'
      },
      {
        id: 'order-cancel',
        question: '注文のキャンセルはできますか？',
        answer: 'ご注文後30分以内はマイページから無料でキャンセル可能です。\n・30分経過後は原則キャンセル不可です\n・製作開始前に限り、事務手数料220円（税込）/1点でキャンセル可能な場合があります'
      },
      {
        id: 'return-exchange',
        question: '商品の返品・交換はできるの？',
        answer: '当社または提携工場の不備による初期不良や配送時の破損は、商品到着後7日以内のご連絡で返品・交換を承ります。\n・お客様都合による返品・交換は原則お受けしておりません'
      }
    ]
  },
  {
    id: 'shipping-delivery',
    title: '配送および納期について',
    icon: Truck,
    items: [
      {
        id: 'delivery-time',
        question: '商品の配送にはどのくらい時間がかかりますか？',
        answer: '商品の種類や配送先によって異なります。\n・通常商品：ご注文から3〜10営業日で発送\n・繁忙期：最大で20営業日程度かかる場合があります\n・発送後、お届けまで1〜3日程度かかります'
      },
      {
        id: 'delivery-area',
        question: '配送可能地域はどこですか？',
        answer: '日本全国への配送が可能です。\n・沖縄・離島への配送も承っております\n・海外配送は現在準備中です'
      },
      {
        id: 'delivery-status',
        question: '配送状況を確認できますか？',
        answer: '発送完了時に配送伝票番号をメールでお知らせします。\n・配送業者のサイトで配送状況を確認できます\n・マイページからも注文状況を確認できます'
      },
      {
        id: 'delivery-date',
        question: '配送日時の指定はできますか？',
        answer: '申し訳ございませんが、現在配送日時の指定は承っておりません。\n・ご不在の場合は再配達をご利用ください\n・将来的には指定サービスの提供を予定しております'
      }
    ]
  },
  {
    id: 'order-flow',
    title: 'ご注文フロー・手続きについて',
    icon: FileText,
    items: [
      {
        id: 'order-process',
        question: '注文の流れを教えてください',
        answer: 'ご注文は以下の流れで行います。\n1. 商品を選択してカートに追加\n2. カート画面で数量・サイズを確認\n3. お客様情報・配送先を入力\n4. お支払い方法を選択\n5. 注文内容を最終確認して注文完了\n6. 注文確認メールをお送りします'
      },
      {
        id: 'guest-order',
        question: '会員登録なしで注文できますか？',
        answer: '現在、購入には会員登録・ログインが必要です。\n・会員登録で注文履歴の確認や再注文が簡単になります'
      },
      {
        id: 'order-modification',
        question: '注文後に内容を変更できますか？',
        answer: 'ご注文確定後の内容変更は原則できません。\n・必要な場合は、キャンセル規定に従って一度キャンセルのうえ再注文をお願いします\n・製作開始後の変更はお受けできません'
      },
      {
        id: 'order-confirmation',
        question: '注文確認メールが届きません',
        answer: '以下をご確認ください。\n・迷惑メールフォルダをご確認ください\n・メールアドレスに誤りがないかご確認ください\n・ドメイン指定受信設定をご確認ください（@seai.co.jpからのメールを受信許可）\n・それでも届かない場合はお問い合わせください'
      }
    ]
  },
  {
    id: 'membership',
    title: '会員登録・アカウントについて',
    icon: UserPlus,
    items: [
      {
        id: 'registration-benefits',
        question: '会員登録のメリットは何ですか？',
        answer: '会員登録いただくと以下のメリットがあります。\n・注文履歴の確認\n・お気に入り作品の保存\n・配送先情報の保存\n・再注文が簡単\n・会員限定情報の配信\n・ポイント制度（準備中）'
      },
      {
        id: 'registration-process',
        question: '会員登録の方法を教えてください',
        answer: '会員登録は簡単です。\n1. 「新規登録」ボタンをクリック\n2. メールアドレスとパスワードを入力\n3. 認証メールをクリックして認証完了\n4. 基本情報を入力して登録完了\n※GoogleアカウントやApple IDでの登録も可能です'
      },
      {
        id: 'password-reset',
        question: 'パスワードを忘れました',
        answer: 'パスワードの再設定が可能です。\n1. ログイン画面の「パスワードを忘れた方」をクリック\n2. 登録メールアドレスを入力\n3. 再設定用メールが送信されます\n4. メール内のリンクから新しいパスワードを設定\n※メールが届かない場合は迷惑メールフォルダをご確認ください'
      },
      {
        id: 'account-deletion',
        question: 'アカウントを削除したい',
        answer: 'アカウントの削除をご希望の場合は、お問い合わせください。\n・削除後は注文履歴等のデータが全て削除されます\n・削除処理には数日かかる場合があります\n・削除後の復旧はできませんのでご注意ください'
      }
    ]
  },
  {
    id: 'item-specs',
    title: 'アイテムの仕様について',
    icon: Star,
    items: [
      {
        id: 'item-quality',
        question: 'アイテムの品質はどうですか？',
        answer: '高品質な素材を使用し、プロの印刷技術で制作しています。色あせしにくく、洗濯にも強い仕上がりです。'
      }
    ]
  },
  {
    id: 'payment',
    title: 'お支払いについて',
    icon: CreditCard,
    items: [
      {
        id: 'payment-methods',
        question: '利用できる支払い方法を教えて',
        answer: 'クレジットカード（Visa、Mastercard、JCB、American Express、Diners Club、Discover）、Apple Pay、Google Pay、コンビニ決済、銀行振込がご利用いただけます。'
      }
    ]
  },
  {
    id: 'other',
    title: 'その他のご質問',
    icon: MessageCircle,
    items: [
      {
        id: 'contact',
        question: 'お問い合わせ方法を教えて',
        answer: 'お問い合わせは以下の方法でお受けしています。\n・メール：photorank@seai.co.jp\n・お問い合わせフォーム（準備中）\n・営業時間：平日10:00〜17:00（土日祝日を除く）'
      }
    ]
  }
]

const popularQuestions = [
  'アイテムの販売の流れを教えて',
  'アイテムの販売って料金がかかるの？',
  '注文の流れを教えてください',
  '会員登録のメリットは何ですか？',
  '送料はいくらかかりますか？',
  '注文後商品どのぐらいで発送されるか教えて',
  '注文のキャンセルはできますか？',
  '商品の返品・交換はできるの？',
  '配送状況を確認できますか？',
  'パスワードを忘れました'
]

export function FAQ() {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const filteredCategories = faqCategories.map(category => ({
    ...category,
    items: category.items.filter(item =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.items.length > 0)

  const displayCategories = selectedCategory
    ? filteredCategories.filter(cat => cat.id === selectedCategory)
    : filteredCategories

  const handleQuestionClick = (itemId: string) => {
    setExpandedItem(expandedItem === itemId ? null : itemId)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヒーローセクション */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">よくある質問</h1>

          {/* 検索フォーム */}
          <div className="relative max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="よくある質問を検索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>

          <p className="mt-6 text-lg">
            商品についてのご質問は、
            <a href="#merch" className="underline hover:no-underline">
              PhotoRankトップページ
            </a>
            からお探しいただけます！
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12">
        {!searchQuery && !selectedCategory && (
          <>
            {/* カテゴリーセクション */}
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-8">カテゴリーから探す</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {faqCategories.map((category) => {
                  const IconComponent = category.icon
                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <IconComponent className="w-6 h-6 text-blue-600" />
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {category.title}
                        </h3>
                        <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* 人気の質問セクション */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-8">よくある質問から探す</h2>
              <div className="bg-white rounded-lg border border-gray-200">
                {popularQuestions.map((question, index) => {
                  const faqItem = faqCategories
                    .flatMap(cat => cat.items)
                    .find(item => item.question === question)

                  return (
                    <button
                      key={index}
                      onClick={() => faqItem && handleQuestionClick(faqItem.id)}
                      className="w-full px-6 py-4 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                    >
                      <span className="text-gray-900">{question}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          </>
        )}

        {/* 検索結果またはカテゴリー表示 */}
        {(searchQuery || selectedCategory) && (
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-gray-900">
                {searchQuery ? `"${searchQuery}" の検索結果` :
                 selectedCategory ? faqCategories.find(cat => cat.id === selectedCategory)?.title : ''}
              </h2>
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  すべてのカテゴリーに戻る
                </button>
              )}
            </div>

            {displayCategories.map((category) => (
              <div key={category.id} className="mb-8">
                {!selectedCategory && (
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <category.icon className="w-5 h-5 text-blue-600" />
                    {category.title}
                  </h3>
                )}

                <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {category.items.map((item) => (
                    <div key={item.id}>
                      <button
                        onClick={() => handleQuestionClick(item.id)}
                        className="w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{item.question}</span>
                          <ChevronRight
                            className={`w-4 h-4 text-gray-400 transition-transform ${
                              expandedItem === item.id ? 'rotate-90' : ''
                            }`}
                          />
                        </div>
                      </button>

                      {expandedItem === item.id && (
                        <div className="px-6 pb-4 text-gray-700 bg-gray-50">
                          <div className="whitespace-pre-line">{item.answer}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {displayCategories.length === 0 && (
              <div className="text-center py-12">
                <HelpCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">質問が見つかりませんでした</h3>
                <p className="text-gray-600">
                  別のキーワードで検索するか、お問い合わせください。
                </p>
              </div>
            )}
          </section>
        )}

        {/* お問い合わせセクション */}
        <section className="mt-16 bg-blue-50 rounded-lg p-8 text-center">
          <MessageCircle className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            お探しの質問が見つからない場合
          </h3>
          <p className="text-gray-600 mb-6">
            お気軽にお問い合わせください。サポートチームが迅速にお答えします。
          </p>
          <a
            href="mailto:photorank@seai.co.jp"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            お問い合わせする
          </a>
        </section>
      </div>
    </div>
  )
}

export default FAQ
