# デザインシステムガイド（Printful × SUZURI × Etsy）

## 原則
- Printful: 機能性・明確な情報階層・データ可視化・プロフェッショナル
- SUZURI: 親しみやすい丸み・カラフル・イラスト・日本語タイポ
- Etsy: 信頼・レビューの見せ方・売り手透明性・温かみ/コミュニティ

## トークン（Tailwind）
- Colors: `primary/secondary/accent/success/warning/error/gray`
  - primary: 信頼感のある青（500: `#3B82F6`）
  - secondary: 親しみやすい紫（500: `#A855F7`）
  - accent: 温かみのある橙（500: `#F97316`）
  - semantic: `success=#10B981`, `warning=#F59E0B`, `error=#EF4444`
- Font: `Noto Sans JP`, `Inter`
  - `fontFamily.sans/display = ['Noto Sans JP', 'Inter', 'system-ui', 'sans-serif']`
  - 日本語は禁則/折返しを考慮し `.jp-text` を併用
- Radius: `rounded-lg` を既定、カードは `rounded-xl`
- Shadow: `shadow-soft`（既定）/ `hover:shadow-medium`/ `hover:shadow-large`
- Dark mode: `darkMode: 'class'`（bodyに`dark`クラス）。色はトークンで両対応

参考: `tailwind.config.js` の `theme.extend.colors`/`fontFamily`/`borderRadius`/`boxShadow`

## ユーティリティ（index.css）
- `.transition-base`: トランジション共通
- `.hover-lift`: Hover時の浮き上がり
- `.skeleton`: スケルトン
- `.fade-in`: フェードイン
- `.container`: 余白
- `.grid-responsive`: 2→3→4→5カラム
- `.line-clamp-1/2/3`: 行数制限（プラグイン無し）
- `.jp-text`: 日本語の禁則/改行最適化

推奨: レイアウト系の繰り返しは `@apply` で`.index.css`に集約、色や余白はトークンを使用

## コンポーネント設計指針
- Button（`components/ui/button.tsx`）
  - Variant: `primary | secondary | success | danger | ghost | link`
  - Size: `sm | md | lg | icon`
  - CVAで一元管理、focus-visibleリング（primary系）、`active:scale-95`、`disabled:opacity-50`
  - 追加時は既存variantの配色/コントラスト（WCAG AA）を踏襲
- Card（`components/ui/card.tsx`）
  - 構成: `Card`/`Card.Header`/`Card.Body`/`Card.Footer`
  - 既定: `rounded-xl shadow-soft border`、`hoverable`で `hover:shadow-large + scale`
- Badge（`components/ui/badge.tsx`）
  - Variant: `default/primary/secondary/success/warning/error` + status系（`pending/approved/suspended`等）
  - Size: `sm | md | lg`
- Input/Textarea/Select（`components/ui`）
  - formsプラグイン前提。`focus-visible:ring-primary`、placeholder/disabled/エラー状態を統一
- Modal（`components/ui/Modal.tsx`）
  - `fade-in`/角丸/影、Backdropクリック/`Esc`で閉じる
  - A11y: フォーカストラップ、`initialFocusSelector`/`initialFocusRef`で初期フォーカス指定可
- Tabs/Table
  - Tabs: ダーク/hover対応、アクティブは`bg-white`（darkは`bg-gray-900`）
  - Table: 行の`hover:bg-gray-50`（darkは`gray-800`）
- Icons/Charts
  - Icons: `lucide-react`
  - Charts: `recharts`（軽量な「目安」可視化に使用）

### ページ固有コンポーネント
- ProductCard（`components/product/ProductCard.tsx`）
  - 大画像 + hoverオーバーレイ + 価格/評価/クリエイター。`Card`ベース、`hover-lift`/スケール
  - タイトルは `.jp-text .line-clamp-2`
- TrustBadges（`components/common/TrustBadges.tsx`）
  - 認証/高評価/実績/応答速。`show*` propsで出し分け可能
- PricingSlider（`components/common/PricingSlider.tsx`）
  - `recharts`で数量対単価の目安カーブ。`discountCurve`/`value`/`onChangeQty`対応
 - SuccessModal（`components/ui/SuccessModal.tsx`）
   - 購入/カート/お気に入り/注文の成功体験を統一（A11y: フォーカス/読み上げ考慮）
 - CartView（`components/buyer/CartView.tsx`）
   - 一括決済のメイン画面。カートアイテムの数量/削除/合計→Stripe決済→SuccessModal

## 実装順
1. トークン/ユーティリティ
2. UIコンポーネント（Button/Card/Badge/Input等）
3. ページ固有（ProductCard/TrustBadges/PricingSlider/Dashboard）
4. レスポンシブ/日本語最適化（line-clamp/禁則）
5. アニメーション/アクセシビリティ
6. 一括決済/サンクスモーダルの統一（任意の最終段）

## アクセシビリティ
- コントラスト比 WCAG AA
- focus-visible リング
- モーダル Esc クローズ/トラップ
- `alt/aria-label` の徹底

トースト: 重要通知は `role="alert"` を検討（現状は視覚優先、必要に応じて拡張）

## レスポンシブ/タイポグラフィ（日本語）
- ブレークポイント: `sm(640)/md(768)/lg(1024)/xl(1280)/2xl(1536)`
- レイアウト: `.grid-responsive`（2→3→4→5列）推奨、カードグリッドはギャップ`gap-4`
- 見出し/本文: `Noto Sans JP`前提。本文`text-sm/leading-relaxed`、見出しは`text-lg/2xl/3xl`を状況に応じて
- 長文: `.jp-text` + `line-clamp` で折返し制御。レビュー/説明/タイトルに適用

## 命名/コーディング規約
- カラー/余白はトークンのみを使用（任意hexや任意rgba禁止）
- レイアウト繰り返しは `.index.css` のユーティリティを`@apply`で再利用
- コンポーネントのVariant追加はCVAで一元管理（例: `button.tsx`）。関連サイズ/状態も同時に見直す
- ダークモードは `dark:` プレフィックスでペアを用意（背景/文字/境界線）
- 過度な `hover:shadow-*` は禁止。`hover-lift` を使用

## 実装例
- PartnerDashboard ステータスカード: グラデ背景 + 白字 + `hover-lift`
- FactoryCompare: 結果カードにTrustBadges/日本語禁則 + Tabs/Tableのhover強調
- Buyer一覧: ProductCardで統一、プレビュー`Modal`から購入へ連結（Stripe）

## よくある追加作業（手順）
1. 新しいVariantを追加（CVA更新、コントラスト確認、サイズ/disabled/activeを確認）
2. ページ固有のカードへ `.transition-base/hover-lift` を適用
3. 長文箇所に `.jp-text .line-clamp-*` を適用
4. モーダル利用時に `initialFocusSelector` を設定しキーボード操作を確認

## 変更履歴（抜粋）
- v1: トークン/ユーティリティ、Button/Card/Badge、FactoryCompareの新カード、Dashboardグラデ統計
- v2: forms統一（Input/Select/Textarea）、Modalのfade-in/フォーカス対応
- v3: ページ固有（ProductCard/TrustBadges/PricingSlider）追加、Tabs/Table hover強化
- v4: 購入導線（Stripe）/カート/お気に入り/トースト、TrustBadgesバリアント化
