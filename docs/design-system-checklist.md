# デザインシステム チェックリスト（PRレビュー用）

## トークン/ユーティリティ
- 色/余白/角丸/影はトークンのみ使用（任意hex禁止）
- レイアウト繰り返しは `.index.css` のユーティリティ（`@apply`）を活用
- ダークモードは `dark:` の対になる色/背景/境界線を用意

## コンポーネント
- Button: 既存Variant/Sizeに揃える（CVA）/ focus-visible / disabled / active確認
- Card: `rounded-xl shadow-soft border` + `hoverable`の挙動統一
- Forms: Input/Select/Textarea は formsプラグイン想定 / placeholder/disabled/error 統一
- Modal: `fade-in` + Esc + フォーカストラップ / 初期フォーカス設定（必要に応じて）

## ページ固有
- ProductCard: 大画像 + hoverオーバーレイ / `.jp-text .line-clamp-2`
- TrustBadges: 必要に応じて `show*` で出し分け
- PricingSlider: 目安の可視化でOK（API連動は任意）
- SuccessModal: 購入/カート/お気に入り/注文で共通使用（初期フォーカス/読み上げ）
- CartView: 一括決済フローがCartViewへ集約されているか（Drawerから誘導）

## 日本語/A11y
- `.jp-text` を長文箇所へ適用 / 必要に応じて `line-clamp`
- alt/aria-labelの網羅 / キーボード操作の確認
- コントラストAA（主要コンポーネント）

## パフォーマンス
- 画像 `loading="lazy"` / 重い影・アニメを抑制
- クリティカルCSSを最小化 / 不要な再レンダリング回避

## 変更時の手順
1. トークン/ユーティリティの再利用を最優先
2. 既存Variantへの影響を確認（回帰）
3. ダークモード/フォーカス/A11yを合わせる
4. スクリーンショット/手動チェックで主要フロー確認
