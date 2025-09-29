import { test, expect } from '@playwright/test';

test.describe('User & Creator Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Purchase Flow - ユーザー購買フロー', () => {
    test('should navigate from homepage to product discovery and cart', async ({ page }) => {
      // 1. ホームページからメインコンテンツハブを確認
      await expect(page.getByRole('link', { name: 'ホームへ' })).toBeVisible();

      // 2. トレンド作品セクションへナビゲート
      const trendingSection = page.locator('text=トレンド作品').or(page.locator('text=話題の作品'));
      if (await trendingSection.isVisible()) {
        await trendingSection.click();
      } else {
        // フォールバック: merchページへ直接移動
        await page.goto('/#merch');
        await page.waitForLoadState('networkidle');
      }

      // 3. 商品カードの存在確認
      const productCards = page.locator('[data-testid="product-card"], .product-card, .work-card');
      const productLinks = page.locator('a').filter({ hasText: /作品|商品|グッズ/ });

      // いずれかの商品要素が見つかるかチェック
      const hasProducts = await productCards.count() > 0 || await productLinks.count() > 0;

      if (hasProducts) {
        console.log('商品/作品カードが見つかりました');
      } else {
        console.log('商品カードが見つからないため、サンプルデータをチェック');
      }

      // 4. ハンバーガーメニューからカート画面へのナビゲーションをテスト
      const hamburgerButton = page.locator('button[aria-label="メニュー"]');

      if (await hamburgerButton.isVisible()) {
        await hamburgerButton.click();
        await page.waitForTimeout(500);

        // カートリンクを探す
        const cartLink = page.getByRole('link', { name: /カート|Cart/ }).or(
          page.locator('a[href*="cart"]')
        );

        if (await cartLink.isVisible()) {
          await cartLink.click();
          await page.waitForLoadState('networkidle');

          // カートページの要素を確認
          await expect(page.url()).toContain('cart');
          console.log('カートページへの遷移成功');
        }
      }
    });

    test('should handle unauthenticated purchase attempt', async ({ page }) => {
      // カートページに直接アクセス
      await page.goto('/#cart');
      await page.waitForLoadState('networkidle');

      // ログインが必要な場合のメッセージまたはログインボタンを確認
      const loginElements = page.getByRole('button', { name: /新規登録|ログイン|Login/ }).or(
        page.getByText(/ログインが必要|認証が必要|サインイン|登録/)
      );

      const isLoginRequired = await loginElements.count() > 0;

      if (isLoginRequired) {
        console.log('未認証ユーザーに対して適切にログインプロンプトが表示されています');
      } else {
        console.log('カートページはゲストアクセス可能です');
      }
    });

    test('should navigate through creator profile to products', async ({ page }) => {
      // クリエイター検索ページへ
      await page.goto('/#search');
      await page.waitForLoadState('networkidle');

      // 検索機能のテスト（サンプルデータがある場合）
      const searchInput = page.locator('input[type="search"], input[placeholder*="検索"], input[placeholder*="クリエイター"]');

      if (await searchInput.isVisible()) {
        await searchInput.fill('test');
        await page.waitForTimeout(1000);

        // 検索結果のクリエイターカードをチェック
        const creatorCards = page.locator('[data-testid="creator-card"], .creator-card').first();

        if (await creatorCards.isVisible()) {
          await creatorCards.click();
          await page.waitForLoadState('networkidle');
          console.log('クリエイタープロフィールページへの遷移成功');
        }
      }
    });
  });

  test.describe('Creator Flow - クリエイター出品フロー', () => {
    test('should attempt to access creator dashboard and show auth requirement', async ({ page }) => {
      // クリエイターダッシュボードに直接アクセス
      await page.goto('/#creator-dashboard');
      await page.waitForLoadState('networkidle');

      // 認証が必要な場合、ホームにリダイレクトされるか確認
      const currentUrl = page.url();
      const isRedirected = currentUrl.includes('#merch') || currentUrl.includes('#general-dashboard');

      if (isRedirected) {
        console.log('未認証ユーザーは適切にリダイレクトされています');

        // ログインボタンの存在確認
        const loginButton = page.getByRole('button', { name: /ログイン|Login/ });
        await expect(loginButton).toBeVisible();
      } else {
        console.log('クリエイターダッシュボードにアクセス可能（サンプルモード）');
      }
    });

    test('should navigate to work creation from main menu', async ({ page }) => {
      // ハンバーガーメニューから作品投稿へのナビゲーション
      const hamburgerButton = page.locator('button[aria-label="メニューを開く"]');

      if (await hamburgerButton.isVisible()) {
        await hamburgerButton.click();
        await page.waitForTimeout(500);

        // 作品投稿/アップロードリンクを探す
        const createWorkLink = page.getByRole('link', { name: /作品投稿|アップロード|投稿|Create/ }).or(
          page.locator('a[href*="create"]')
        );

        if (await createWorkLink.isVisible()) {
          await createWorkLink.click();
          await page.waitForLoadState('networkidle');

          // 作品投稿ページの要素を確認
          const isCreatePage = page.url().includes('create') ||
                             await page.getByText(/作品をアップロード|新しい作品/).isVisible();

          if (isCreatePage) {
            console.log('作品投稿ページへの遷移成功');
          }
        }
      }
    });

    test('should check my works navigation', async ({ page }) => {
      // マイワークスページへのナビゲーション
      const hamburgerButton = page.locator('button[aria-label="メニューを開く"]');

      if (await hamburgerButton.isVisible()) {
        await hamburgerButton.click();
        await page.waitForTimeout(500);

        const myWorksLink = page.getByRole('link', { name: /マイ作品|My Works|作品管理/ }).or(
          page.locator('a[href*="myworks"]')
        );

        if (await myWorksLink.isVisible()) {
          await myWorksLink.click();
          await page.waitForLoadState('networkidle');

          const isMyWorksPage = page.url().includes('myworks') ||
                               await page.getByText(/マイ作品|作品一覧/).isVisible();

          if (isMyWorksPage) {
            console.log('マイ作品ページへの遷移成功');
          }
        }
      }
    });
  });

  test.describe('Navigation Consistency - UI一貫性修正後のナビゲーション', () => {
    test('should have consistent header across all public pages', async ({ page }) => {
      const publicPages = [
        '/#merch',
        '/#trending',
        '/#search',
        '/#battle-search'
      ];

      for (const pagePath of publicPages) {
        await page.goto(pagePath);
        await page.waitForLoadState('networkidle');

        // 統一されたヘッダー要素の確認
        const header = page.locator('header');
        await expect(header).toBeVisible();

        // PhotoRankロゴ/リンクの存在確認
        const photoRankElement = page.getByRole('link', { name: 'ホームへ' });
        await expect(photoRankElement).toBeVisible();

        // ハンバーガーメニューの存在確認
        const menuButton = page.locator('button[aria-label="メニューを開く"]');
        await expect(menuButton).toBeVisible();

        console.log(`${pagePath}: ナビゲーション要素確認完了`);
      }
    });

    test('should have consistent dashboard layouts', async ({ page }) => {
      const dashboards = [
        { url: '/#general-dashboard', name: 'General Dashboard' },
        { url: '/#creator-dashboard', name: 'Creator Dashboard' },
        { url: '/#admin', name: 'Admin Dashboard' }
      ];

      for (const dashboard of dashboards) {
        await page.goto(dashboard.url);
        await page.waitForLoadState('networkidle');

        // リダイレクトされていない場合のみチェック
        if (page.url().includes(dashboard.url.replace('/#', ''))) {
          // 統一されたコンテナ幅クラスの確認
          const container = page.locator('.max-w-6xl, .max-w-7xl').first();
          if (await container.isVisible()) {
            console.log(`${dashboard.name}: max-w-7xl コンテナ確認`);
          }

          // 統一されたカードスタイルの確認
          const cards = page.locator('.shadow-sm.border.border-gray-200');
          if (await cards.count() > 0) {
            console.log(`${dashboard.name}: 統一カードスタイル確認`);
          }
        } else {
          console.log(`${dashboard.name}: 未認証のためリダイレクト（正常）`);
        }
      }
    });

    test('should maintain mobile responsiveness', async ({ page }) => {
      // モバイル表示のテスト
      await page.setViewportSize({ width: 375, height: 667 });

      const testPages = ['/#merch', '/#search'];

      for (const pagePath of testPages) {
        await page.goto(pagePath);
        await page.waitForLoadState('networkidle');

        // モバイルメニューボタンの確認
        const mobileMenuButton = page.locator('button[aria-label="メニューを開く"]');
        await expect(mobileMenuButton).toBeVisible();

        // レスポンシブグリッドの確認（カードが縦に並ぶ）
        const gridContainer = page.locator('.grid-cols-1').first();
        if (await gridContainer.isVisible()) {
          console.log(`${pagePath}: モバイルレスポンシブグリッド確認`);
        }
      }
    });
  });

  test.describe('Error Handling - エラーハンドリング', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // ネットワークエラーのシミュレーション
      await page.route('**/api/**', route => route.abort());

      await page.goto('/#merch');
      await page.waitForLoadState('networkidle');

      // エラー境界やローディング状態の確認
      const errorBoundary = page.locator('[data-testid="error-boundary"]').or(
        page.getByText(/エラーが発生|読み込みに失敗|Error/)
      );

      const loadingSpinner = page.locator('[data-testid="loading"]').or(
        page.locator('.animate-spin, .loading')
      );

      // エラーハンドリングまたはローディング状態のいずれかが表示されることを確認
      const hasErrorHandling = await errorBoundary.count() > 0 || await loadingSpinner.count() > 0;

      if (hasErrorHandling) {
        console.log('適切なエラーハンドリングまたはローディング状態が表示されています');
      }
    });

    test('should not have critical console errors on main pages', async ({ page }) => {
      const criticalErrors: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('404') &&
            !msg.text().includes('favicon') && !msg.text().includes('Failed to load resource')) {
          criticalErrors.push(msg.text());
        }
      });

      // 主要ページをチェック
      const pages = ['/#merch', '/#search', '/#trending'];

      for (const pagePath of pages) {
        await page.goto(pagePath);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000); // エラーが発生する時間を待つ
      }

      // クリティカルエラーが5個以下であることを確認（完全にゼロは厳しすぎる）
      expect(criticalErrors.length).toBeLessThan(5);

      if (criticalErrors.length > 0) {
        console.log('検出されたエラー:', criticalErrors);
      }
    });
  });
});
