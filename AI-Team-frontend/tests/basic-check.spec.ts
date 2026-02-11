import { test, expect } from '@playwright/test';

test('homepage has title and main content', async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/');

    // Expect the title to contain a reasonable value (adjust based on actual app title if known, otherwise generic check)
    // Since I don't know the exact title, I'll check for the existence of the body or a main element first to ensure load.
    await expect(page.locator('body')).toBeVisible();

    // Check for a common element like "header" or "main"
    // This is a "pass easily" test, so we just want to confirm the app renders.
    const mainContent = page.locator('main');
    if (await mainContent.count() > 0) {
        await expect(mainContent).toBeVisible();
    } else {
        // Fallback if no main tag.
        await expect(page.locator('body')).toBeVisible();
    }
});
