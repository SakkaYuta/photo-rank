# 要件定義書 v3.1 - 推し活グッズプラットフォーム【最終確定版】

## プロジェクト概要

### ビジョン
推し活グッズを誰でも簡単に作成・販売できるプラットフォーム

### 主要機能
1. 推し活グッズ45種類の作成・販売
2. オーガナイザー（事務所）によるクリエイター管理
3. 複数製造パートナーAPI連携
4. 透かし付きプレビューと画像保護
5. 月次支払いシステム（末締め翌々月末払い）

## ユーザーロール

### 1. クリエイター
- グッズデザインのアップロード・販売
- 価格設定（取り分: 0〜10,000円）
- オーガナイザー所属可能

### 2. オーガナイザー
- 所属クリエイターの管理
- 全商品の出品承認（必須）
- 売上の一括受領
- クリエイターへの配分はオーガナイザー責任で実施

### 3. 購入者
- グッズ購入・カスタマイズ

### 4. 管理者
- プラットフォーム全体管理

## 支払いフロー（確定版）

### 個人クリエイター
```
売上 → プラットフォーム手数料30% → クリエイター口座（70%）
```

### オーガナイザー所属クリエイター
```
売上 → プラットフォーム手数料30% → オーガナイザー口座（70%）

※ここまでがプラットフォームの責任範囲
※以降のクリエイターへの配分はオーガナイザーが独自に管理
```

### 重要な仕様
- プラットフォームはオーガナイザーへの振込後は関与しない
- クリエイターへの配分方法・割合はオーガナイザーの裁量
- プラットフォーム上では配分記録を保持しない

## データベース設計（支払い関連）

```sql
-- オーガナイザー
CREATE TABLE organizers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_type text,
  tax_id text,
  representative_name text NOT NULL,
  contact_email text NOT NULL,
  bank_account_id uuid REFERENCES bank_accounts(id),
  approval_mode text DEFAULT 'manual', -- 全商品承認必須
  status text DEFAULT 'active',
  created_at timestamp DEFAULT now()
);

-- クリエイター契約（簡略化）
CREATE TABLE creator_organizer_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES users(id) NOT NULL,
  organizer_id uuid REFERENCES organizers(id) NOT NULL,
  status text DEFAULT 'active',
  joined_at timestamp DEFAULT now(),
  terminated_at timestamp,
  UNIQUE(creator_id, organizer_id, status)
);

-- 出品承認（全商品対象）
CREATE TABLE publishing_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) NOT NULL,
  organizer_id uuid REFERENCES organizers(id) NOT NULL,
  reviewer_id uuid REFERENCES users(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_at timestamp,
  created_at timestamp DEFAULT now()
);

-- 支払い（シンプル化）
CREATE TABLE payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type text CHECK (recipient_type IN ('creator', 'organizer')),
  recipient_id uuid NOT NULL, -- user_id or organizer_id
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_amount integer NOT NULL,
  platform_fee integer NOT NULL, -- 30%
  net_amount integer NOT NULL,   -- 70%
  bank_transfer_fee integer DEFAULT 250,
  final_payout integer NOT NULL,
  status text DEFAULT 'scheduled',
  scheduled_date date NOT NULL,
  paid_at timestamp,
  created_at timestamp DEFAULT now()
);

-- 売上記録（配分は記録しない）
CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) NOT NULL,
  creator_id uuid REFERENCES users(id) NOT NULL,
  organizer_id uuid REFERENCES organizers(id), -- 所属している場合
  amount integer NOT NULL,
  platform_fee integer NOT NULL,
  net_amount integer NOT NULL,
  created_at timestamp DEFAULT now()
);
```

## オーガナイザー承認フロー

### 全商品承認制
```ts
interface ApprovalFlow {
  // ステップ1: クリエイターが商品作成
  createProduct(data: ProductData): Product;
  
  // ステップ2: 自動的に承認待ちへ
  submitForApproval(productId: string): void;
  
  // ステップ3: オーガナイザーが承認/却下
  review(productId: string): {
    approve: () => void;
    reject: (reason: string) => void;
  };
  
  // ステップ4: 承認後のみ販売開始
  publish(productId: string): void;
}
```

### 承認画面UI（イメージ）
```tsx
const OrganizerApprovalDashboard = () => {
  const [pendingProducts, setPendingProducts] = useState([]);
  
  return (
    <div>
      <h2>承認待ち商品（全{pendingProducts.length}件）</h2>
      
      {pendingProducts.map(product => (
        <div key={product.id} className="border rounded p-4 mb-4">
          <div className="flex gap-4">
            {/* 商品画像（透かし付き） */}
            <img src={product.watermarkedImage} className="w-32 h-32" />
            
            {/* 商品情報 */}
            <div className="flex-1">
              <h3>{product.title}</h3>
              <p>クリエイター: {product.creatorName}</p>
              <p>商品種類: {product.productTypes.join(', ')}</p>
              <p>価格: ¥{product.price}</p>
            </div>
            
            {/* 承認ボタン */}
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => approve(product.id)}
                className="bg-green-600 text-white px-4 py-2 rounded"
              >
                承認
              </button>
              <button 
                onClick={() => openRejectModal(product.id)}
                className="bg-red-600 text-white px-4 py-2 rounded"
              >
                却下
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
```

## 月次支払い処理

```sql
-- 月次支払い生成（簡略版）
CREATE OR REPLACE FUNCTION generate_monthly_payouts()
RETURNS void AS $$
DECLARE
  v_period_start date;
  v_period_end date;
  v_payment_date date;
BEGIN
  -- 前月の期間
  v_period_start := date_trunc('month', CURRENT_DATE - interval '1 month');
  v_period_end := date_trunc('month', CURRENT_DATE) - interval '1 day';
  -- 翌々月末
  v_payment_date := date_trunc('month', CURRENT_DATE + interval '2 month') - interval '1 day';
  
  -- 個人クリエイター向け支払い
  INSERT INTO payouts (recipient_type, recipient_id, period_start, period_end, 
                       gross_amount, platform_fee, net_amount, final_payout, scheduled_date)
  SELECT 
    'creator',
    s.creator_id,
    v_period_start,
    v_period_end,
    SUM(s.amount),
    SUM(s.platform_fee),
    SUM(s.net_amount),
    CASE 
      WHEN SUM(s.net_amount) >= 5000 THEN SUM(s.net_amount) - 250
      ELSE 0
    END,
    v_payment_date
  FROM sales s
  WHERE s.created_at BETWEEN v_period_start AND v_period_end
    AND s.organizer_id IS NULL  -- 個人クリエイターのみ
  GROUP BY s.creator_id;
  
  -- オーガナイザー向け支払い
  INSERT INTO payouts (recipient_type, recipient_id, period_start, period_end,
                       gross_amount, platform_fee, net_amount, final_payout, scheduled_date)
  SELECT 
    'organizer',
    s.organizer_id,
    v_period_start,
    v_period_end,
    SUM(s.amount),
    SUM(s.platform_fee),
    SUM(s.net_amount),
    CASE 
      WHEN SUM(s.net_amount) >= 5000 THEN SUM(s.net_amount) - 250
      ELSE 0
    END,
    v_payment_date
  FROM sales s
  WHERE s.created_at BETWEEN v_period_start AND v_period_end
    AND s.organizer_id IS NOT NULL  -- オーガナイザー所属
  GROUP BY s.organizer_id;
END;
$$ LANGUAGE plpgsql;
```

## RLSポリシー（概念）

```sql
-- 商品は承認後のみ公開（オーガナイザー所属の場合）
CREATE POLICY products_need_approval ON products
  FOR SELECT USING (
    -- 個人クリエイターの商品は即公開
    (creator_id IN (
      SELECT id FROM users WHERE id = creator_id
      AND id NOT IN (
        SELECT creator_id FROM creator_organizer_contracts WHERE status = 'active'
      )
    ))
    OR
    -- オーガナイザー所属は承認済みのみ
    EXISTS (
      SELECT 1 FROM publishing_approvals
      WHERE product_id = products.id AND status = 'approved'
    )
  );

-- 売上情報へのアクセス
CREATE POLICY sales_access ON sales
  FOR SELECT USING (
    -- 個人クリエイターは自分の売上のみ
    (creator_id = auth.uid() AND organizer_id IS NULL)
    OR
    -- オーガナイザーは所属クリエイターの売上を閲覧可能
    organizer_id IN (
      SELECT organizer_id FROM organizer_members
      WHERE user_id = auth.uid()
    )
    OR
    -- 管理者
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
```

## 実装優先順位

### Phase 1: 基本機能（1週間）
1. 商品作成・販売フロー
2. 透かし処理
3. 製造API連携（SUZURI, pixivFACTORY）
4. Stripe決済

### Phase 2: オーガナイザー機能（1週間）
1. オーガナイザー登録
2. クリエイター招待・紐付け
3. 全商品承認フロー
4. 承認画面UI

### Phase 3: 支払い（3日）
1. 月次集計処理
2. 振込処理
3. 支払い履歴管理
4. 最低金額・繰越処理

### Phase 4: 管理・レポート（3日）
1. 売上ダッシュボード
2. CSVエクスポート
3. 通知機能
4. 契約解除フロー

## システム全体図（概念）

```
[購入者] → [商品購入] → [売上発生]
                           ↓
                    [プラットフォーム]
                           ↓
                    手数料30%を差引
                           ↓
        個人クリエイター ← → オーガナイザー
              ↓                    ↓
        [個人口座へ振込]    [オーガナイザー口座へ振込]
                                   ↓
                            ※以降はプラットフォーム外
                            [クリエイターへ独自配分]
```

## 重要な仕様確認

- オーガナイザーへの振込後、プラットフォームは関与しない
- 全商品が承認対象（オーガナイザー所属の場合）
- 支払いは月末締め翌々月末払い
- 最低支払額5,000円、振込手数料250円
- 画像は透かし付きプレビュー、製造時のみ原画像アクセス

この要件定義により、シンプルで明確な責任範囲を持つプラットフォームを実現します。

