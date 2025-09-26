import { test, expect } from '@playwright/test';

test.describe('Route Guards', () => {
  test('should redirect unauthenticated user from creator dashboard to home', async ({ page }) => {
    // Navigate to creator dashboard without authentication
    await page.goto('/#creator-dashboard');

    // Wait for potential redirects
    await page.waitForLoadState('networkidle');

    // Should be redirected to merch/home page
    await expect(page.url()).toMatch(/#(merch|$)/);

    // Should show PhotoRank on the redirected page (use specific selector)
    await expect(page.getByRole('link', { name: 'ホームへ' })).toBeVisible();
  });

  test('should redirect unauthenticated user from admin dashboard', async ({ page }) => {
    await page.goto('/#admin-dashboard');
    await page.waitForLoadState('networkidle');

    // Should be redirected to home
    await expect(page.url()).toMatch(/#(merch|$)/);
    await expect(page.getByRole('link', { name: 'ホームへ' })).toBeVisible();
  });

  test('should redirect unauthenticated user from factory dashboard', async ({ page }) => {
    await page.goto('/#factory-dashboard');
    await page.waitForLoadState('networkidle');

    // Should be redirected to home
    await expect(page.url()).toMatch(/#(merch|$)/);
    await expect(page.getByRole('link', { name: 'ホームへ' })).toBeVisible();
  });

  test('should redirect unauthenticated user from organizer dashboard', async ({ page }) => {
    await page.goto('/#organizer-dashboard');
    await page.waitForLoadState('networkidle');

    // Should be redirected to home
    await expect(page.url()).toMatch(/#(merch|$)/);
    await expect(page.getByRole('link', { name: 'ホームへ' })).toBeVisible();
  });

  test('should allow access to public pages', async ({ page }) => {
    const publicPages = [
      '/#merch',
      '/#trending',
      '/#creator-search',
      '/#battle-search'
    ];

    for (const pagePath of publicPages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');

      // Should not be redirected (URL should contain the path)
      await expect(page.url()).toContain(pagePath);

      // Should show PhotoRank header (use specific selector)
      await expect(page.getByRole('link', { name: 'ホームへ' })).toBeVisible();
    }
  });

  test('should display login button on public pages when not authenticated', async ({ page }) => {
    await page.goto('/#merch');
    await page.waitForLoadState('networkidle');

    // Should show login button (try multiple selectors)
    const loginButton = page.getByRole('button', { name: /ログイン|Login|log in/i });
    const loginLink = page.getByRole('link', { name: /ログイン|Login|log in/i });
    await expect(loginButton.or(loginLink)).toBeVisible();
  });
});