import { test, expect } from '@playwright/test';

test.describe('Help Modal', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('.toolbar');
    });

    test('help modal is hidden on load', async ({ page }) => {
        const helpModal = page.locator('#help');
        await expect(helpModal).not.toBeVisible();
    });

    test('clicking help button shows the help modal', async ({ page }) => {
        await page.locator('#help-button').click();
        const helpModal = page.locator('#help');
        await expect(helpModal).toBeVisible();
    });

    test('clicking help button a second time hides the help modal', async ({ page }) => {
        const helpButton = page.locator('#help-button');
        await helpButton.click(); // open
        await helpButton.click(); // close
        const helpModal = page.locator('#help');
        await expect(helpModal).not.toBeVisible();
    });

    test('help modal contains welcome text', async ({ page }) => {
        await page.locator('#help-button').click();
        await expect(page.locator('#tabs-home')).toContainText('Welcome to the Safer Street Maker');
    });

    test('clicking a tab switches the visible panel', async ({ page }) => {
        await page.locator('#help-button').click();

        // The Welcome panel is shown by default; the Features panel is hidden.
        await expect(page.locator('#tabs-home')).toBeVisible();
        await expect(page.locator('#tabs-features')).not.toBeVisible();

        await page.locator('a[data-tab-target="#tabs-features"]').click();

        await expect(page.locator('#tabs-features')).toBeVisible();
        await expect(page.locator('#tabs-home')).not.toBeVisible();
    });

    test('clicking the help modal close button hides the modal', async ({ page }) => {
        await page.locator('#help-button').click();
        await page.locator('button[name="closeHelp"]').first().click();

        await expect(page.locator('#help')).not.toBeVisible();
    });

    test('opening another modal closes the help popup first', async ({ page }) => {
        await page.locator('#help-button').click();
        await expect(page.locator('#help')).toBeVisible();

        await page.locator('#settings-button').click();

        await expect(page.locator('#help')).not.toBeVisible();
        await expect(page.locator('#read-only')).toBeVisible();
    });

    test('opening help while another modal is open closes that modal and clears its selected button', async ({
        page,
    }) => {
        await page.locator('#settings-button').click();
        await expect(page.locator('#read-only')).toBeVisible();
        await expect(page.locator('#settings-button')).toHaveClass(/selected/);

        await page.locator('#help-button').click();

        await expect(page.locator('#help')).toBeVisible();
        await expect(page.locator('#read-only')).not.toBeVisible();
        await expect(page.locator('#settings-button')).not.toHaveClass(/selected/);
    });
});
