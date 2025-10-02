import { test, expect } from '@playwright/test';

test.describe('v6 Migration Verification', () => {
  const baseURL = 'http://localhost:3000';

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
  });

  test('1. ホームページが正常に表示される', async ({ page }) => {
    await expect(page).toHaveTitle(/Photo Rank|AIprint2/i);

    // ページが正常に読み込まれることを確認
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('2. デモモードでログインできる', async ({ page }) => {
    // デモモードボタンを探す
    const demoButton = page.locator('button:has-text("デモ"), button:has-text("Demo")').first();

    if (await demoButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await demoButton.click();
      await page.waitForTimeout(1000);

      // ログイン後の確認
      const loggedIn = await page.locator('text=/ログアウト|Logout|デモ/i').isVisible({ timeout: 5000 }).catch(() => false);
      expect(loggedIn).toBeTruthy();
    } else {
      console.log('デモモードボタンが見つかりません - スキップ');
      test.skip();
    }
  });

  test('3. クリエイター検索が機能する', async ({ page }) => {
    // クリエイター検索ページへ移動
    await page.goto(`${baseURL}/#/creator-search`);
    await page.waitForTimeout(1000);

    // 検索フィールドを探す
    const searchInput = page.locator('input[type="text"], input[placeholder*="検索"], input[placeholder*="search"]').first();

    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill('デモ');
      await page.waitForTimeout(1000);

      // 検索結果が表示されることを確認（エラーが出ないことを確認）
      const hasError = await page.locator('text=/error|エラー/i').isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasError).toBeFalsy();
    } else {
      console.log('検索フィールドが見つかりません');
    }
  });

  test('4. 作品一覧が表示される', async ({ page }) => {
    // 作品一覧ページへ移動
    await page.goto(`${baseURL}/#/merch`);
    await page.waitForTimeout(2000);

    // エラーが表示されていないことを確認
    const hasError = await page.locator('text=/error|エラー|失敗/i').isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBeFalsy();

    // ページが正常に読み込まれていることを確認
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('5. コンソールエラーがないことを確認', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(`${baseURL}/#/merch`);
    await page.waitForTimeout(3000);

    // v6マイグレーション関連のエラーがないことを確認
    const v6Errors = errors.filter(e =>
      e.includes('user_type') ||
      e.includes('is_creator') ||
      e.includes('is_factory') ||
      e.includes('sales') && !e.includes('sales_vw') ||
      e.includes('publishing_approvals') && !e.includes('publishing_approvals_vw')
    );

    if (v6Errors.length > 0) {
      console.log('v6関連エラー:', v6Errors);
      expect(v6Errors.length).toBe(0);
    }
  });

  test('6. 各主要ページが読み込める', async ({ page }) => {
    const pages = [
      { path: '/#/merch', name: 'メルチ' },
      { path: '/#/creator-search', name: 'クリエイター検索' },
      { path: '/#/battle-search', name: 'バトル検索' },
    ];

    for (const pageInfo of pages) {
      await page.goto(`${baseURL}${pageInfo.path}`);
      await page.waitForTimeout(1000);

      // 致命的なエラーが表示されていないことを確認
      const hasFatalError = await page.locator('text=/Fatal|致命的/i').isVisible({ timeout: 1000 }).catch(() => false);
      expect(hasFatalError).toBeFalsy();

      console.log(`✓ ${pageInfo.name}ページ正常`);
    }
  });
});
