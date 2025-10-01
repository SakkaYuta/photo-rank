# Sponsored Events (飲食店スポンサード・イベント) 実装アイデアまとめ

本ドキュメントは、後日実装するスポンサード・イベント機能の設計アイデアを、実装に移せる粒度で整理したものです。DB定義は別紙を参照してください。

- 参照: `docs/database/SPONSORED_EVENTS_SCHEMA.md`
- フラグ: `VITE_SPONSORED_EVENTS_ENABLED`（フロント有効化）

## 概要 / 目的
- 期間限定の協賛キャンペーンを開催し、ユーザーがライブバトルに参加・勝利することで進捗が貯まり、デジタル報酬（バッジ/タイトル/エフェクト）が得られる。
- オフライン要素なしにアプリ内で価値が完結。一般ユーザーも無料/軽課金で参加価値が明確。

## スコープ（MVP）
- 期間・協賛情報の表示（ロゴ/名称/説明）
- 勝利/ポイントの進捗集計（ユーザー×キャンペーン）
- しきい値（wins到達）報酬の自動付与（デジタルコスメ）
- ランキング（points/wins）と報酬付与（バッチ処理 or 終了時確定）
- UI: 一覧/詳細/進捗/リーダーボード/報酬獲得通知

非対象（後続）
- オフライン連動（来店/引換）
- POS/予約API連携、地理制限

## データモデル（要点）
- `sponsored_campaigns`: 本体（期間/表示/倍率/ルール）
- `campaign_participations`: 進捗（wins/points）
- `campaign_battle_logs`: 冪等/監査ログ（再計算ソース）
- `campaign_rewards`: しきい値/ランキング報酬定義
- `user_campaign_rewards`: 付与台帳（冪等）
- `cosmetics` / `user_cosmetics`: デジタル報酬カタログ/所持

詳細は `docs/database/SPONSORED_EVENTS_SCHEMA.md` を参照。

## イベントフロー
1) バトル終了（既存フロー）
- 対象キャンペーン（期間・ルール条件一致）抽出
- logs upsert（unique(campaign_id,battle_id,user_id)）
- participations upsert（wins/points加算）
- しきい値判定→付与台帳 upsert→`user_cosmetics`発行

2) ランキング（5分間隔 or 終了時確定）
- `campaign_participations` から top100 を集計
- ランキング報酬付与（冪等）

## 報酬定義
- Threshold: `[{"metric":"wins","gte":3, reward:{badge}}, ...]`
- Ranking: `[{"rank_min":1,"rank_max":1, reward:{badge,title,effect}}, ...]`
- 付与は `user_campaign_rewards`→`user_cosmetics` に反映（重複はuniqueで抑止）

## API / Functions（案）
- Edge Functions
  - `battle_finish_hook(battle_id)`：バトル終了後に集計→付与
  - `recompute_campaign_ranking(campaign_id)`：ランキング確定/報酬付与
- Public API（RPC/HTTP）
  - `list_active_campaigns()`：公開一覧
  - `get_campaign_progress(campaign_id, user_id)`：進捗と次報酬まで
  - `list_campaign_leaderboard(campaign_id, limit, offset)`：順位
  - `list_user_rewards(campaign_id?, user_id)`：付与履歴

## RLS / セキュリティ
- `sponsored_campaigns`/`campaign_rewards`: 公開SELECT、writeはadmin
- `campaign_participations`/`user_campaign_rewards`: 本人のみSELECT、付与/更新はservice_role関数経由
- `campaign_battle_logs`: service_role専用

## キャッシュ / パフォーマンス
- 進捗: SWR + TTL 10–15秒（in-flight de-dupe）
- リーダーボード: top100をテーブル/マテビュー化、APIは30秒キャッシュ
- 付与判定: 勝利時のみ、ランキングはバッチ/終了時のみ
- インデックス: participations (campaign_id, points desc), (campaign_id, wins_count desc)

## UI / UX（MVP）
- ライブヘッダーに「協賛: 店名」+ 残期間/倍率
- 右パネル「コラボ」: 次の報酬まで（あとX勝）/報酬一覧/所持コスメ
- リーダーボード: 上位 + 自分の順位（30秒更新）
- 獲得通知: toast + 通知センター

## ポイント設計（暫定）
- 勝利=100pt（可変）
- 倍率: campaign倍率 + スポンサータイム（合算上限1.25）
- 敗北: lossesのみ加算（順位はpoints/wins）

## 段階導入
- v1: campaigns + participations + しきい値報酬
- v1.1: ランキング + リーダーボード + バッチ
- v1.2: コスメUI/プロフィール装備
- v1.3: 倍率/スポンサータイム演出

## KPI / 監視
- 参加ユーザー数、勝利数、到達報酬率、コスメ使用率
- LB更新時間、付与件数、重複スキップ数
- Rate limit: 進捗/順位APIのユーザー別閾値

## 工数見積（目安）
- フェーズ1（3–4日）：スキーマ/RPC/参加API/終了連動
- フェーズ2（2–3日）：報酬付与/ランキング/キャッシュ/管理UI
- フェーズ3（2–3日）：一覧/詳細/進捗/順位/通知UI
- 合計：7–10日

## TODO チェックリスト
- [ ] マイグレーション（スキーマ/RLS/インデックス）
- [ ] `battle_finish_hook` 実装/接続
- [ ] ランキング集計バッチ/終了時確定
- [ ] API: 一覧/進捗/順位/報酬履歴
- [ ] UI: ライブ連携/進捗/リーダーボード/通知
- [ ] フィーチャーフラグ: `VITE_SPONSORED_EVENTS_ENABLED`
- [ ] メトリクス/レート制限/エラー監視

