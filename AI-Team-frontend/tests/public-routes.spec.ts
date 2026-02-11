import { test, expect } from '@playwright/test';

test.describe('Public Routes', () => {

    test('Landing Page loads correctly', async ({ page }) => {
        await page.goto('/');

        // Check for main title using role to be more specific yet robust against span splits if checking content
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.getByRole('heading', { level: 1 })).toContainText('La tua Azienda di');

        // Check for "Accedi" button (assuming not logged in)
        // Using getByRole is better for accessibility checks too
        await expect(page.getByRole('button', { name: 'Accedi' })).toBeVisible();
    });

    test('Business AI Box Page loads correctly', async ({ page }) => {
        await page.goto('/box/business-ai');

        // Check for specific text on this landing page using text locator but being careful with breaks
        await expect(page.locator('h1')).toContainText('NON REGALARE');
        await expect(page.locator('h1')).toContainText('REGALA IL FUTURO');

        // Check for Pricing section headers
        await expect(page.getByRole('heading', { name: 'Scegli il Box' })).toBeVisible();
        // Start and Premium boxes might be h3
        await expect(page.getByRole('heading', { name: 'Box START' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Box PREMIUM' })).toBeVisible();
    });

});
