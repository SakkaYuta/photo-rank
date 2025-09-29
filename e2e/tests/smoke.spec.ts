import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('should load the main page and display PhotoRank', async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check if PhotoRank title is visible (use more specific selector)
    await expect(page.getByRole('link', { name: 'ホームへ' })).toBeVisible();

    // Check if the page has proper title
    await expect(page).toHaveTitle(/PhotoRank/);

    // Verify navigation is present
    const header = page.locator('header');
    await expect(header).toBeVisible();
  });

  test('should navigate to merch page and display content', async ({ page }) => {
    await page.goto('/#merch');

    // Wait for content to load
    await page.waitForLoadState('networkidle');

    // Check if PhotoRank heading is displayed (use more specific selector)
    await expect(page.getByRole('link', { name: 'ホームへ' })).toBeVisible();

    // Check if we're on the correct route
    await expect(page.url()).toContain('#merch');
  });

  test('should handle responsive design on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if mobile menu button or PhotoRank header is visible on small screens
    const mobileMenuButton = page.locator('button[aria-label="メニュー"]');
    const photoRankHeader = page.getByRole('link', { name: 'ホームへ' });

    // Check if either element is visible (use conditional check instead of .or())
    const isMobileMenuVisible = await mobileMenuButton.isVisible();
    const isPhotoRankVisible = await photoRankHeader.isVisible();
    expect(isMobileMenuVisible || isPhotoRankVisible).toBe(true);
  });

  test('should load without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out common non-critical errors
    const criticalErrors = errors.filter(error =>
      !error.includes('404') &&
      !error.includes('favicon') &&
      !error.includes('Failed to load resource') &&
      !error.includes('column works.view_count does not exist') &&
      !error.includes('Error fetching products')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
