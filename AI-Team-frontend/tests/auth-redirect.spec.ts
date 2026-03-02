import { test, expect } from '@playwright/test';

test.describe('Auth Redirection', () => {

    test('Dashboard redirects to Landing Page when not authenticated', async ({ page }) => {
        // Navigate to protected route
        await page.goto('/dashboard')

        // Wait for navigation/redirection to happen
        await page.waitForURL('http://localhost:3002/');

        // Ensure we are back on the landing page
        await expect(page).toHaveURL('http://localhost:3002/');
        await expect(page.getByRole('button', { name: 'Accedi' })).toBeVisible();
    });

    test('Dashboard sub-routes also redirect', async ({ page }) => {
        await page.goto('/dashboard/aladino-ai');
        await page.waitForURL('http://localhost:3002/');
        await expect(page).toHaveURL('http://localhost:3002/');
    });

});
