import { test, expect } from '@playwright/test';

test.describe('Help Panel', () => {
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

    test('Features tab documents Bus Lanes', async ({ page }) => {
        await page.locator('#help-button').click();
        await page.locator('a[data-tab-target="#tabs-features"]').click();

        const busLanesHeading = page.locator('#tabs-features h2').filter({ hasText: 'Bus Lanes' });
        await expect(busLanesHeading).toBeVisible();
        await expect(busLanesHeading.locator('img')).toHaveAttribute('src', /bus-lane\.svg/);
        await expect(page.locator('#tabs-features')).toContainText(
            'right-click or hold the Tram button'
        );
        await expect(page.locator('#tabs-features')).toContainText('select the Bus Lane button');
    });

    test('Groups tab appears between Features and Maps with version guidance', async ({ page }) => {
        await page.locator('#help-button').click();

        const tabs = page.locator('[data-tab-nav] [role="presentation"]');
        await expect(tabs.nth(1)).toContainText('Features');
        await expect(tabs.nth(2)).toContainText('Groups');
        await expect(tabs.nth(3)).toContainText('Maps');

        await page.locator('a[data-tab-target="#tabs-groups"]').click();

        await expect(page.locator('#tabs-groups')).toBeVisible();
        await expect(page.locator('#tabs-groups')).toContainText('Group versions');
        await expect(page.locator('#tabs-groups')).toContainText('version dropdown');
        await expect(page.locator('#tabs-groups')).toContainText('all LTN cells in the group');
        await expect(page.locator('#tabs-groups')).toContainText('striped pattern');
        await expect(page.locator('#tabs-groups')).toContainText('Group phases');
        await expect(page.locator('#tabs-groups')).toContainText('New phase');
        await expect(page.locator('#tabs-groups')).toContainText('ordered sequence');
        await expect(page.locator('#tabs-groups')).toContainText('dragging them in the list');
    });

    test('Sharing tab explains group and version links', async ({ page }) => {
        await page.locator('#help-button').click();
        await page.locator('a[data-tab-target="#tabs-sharing"]').click();

        await expect(page.locator('#tabs-sharing')).toContainText('identifies the group');
        await expect(page.locator('#tabs-sharing')).toContainText('active version number');
        await expect(page.locator('#tabs-sharing')).toContainText('read-only mode');
        await expect(page.locator('#tabs-sharing')).toContainText('implementation phases');
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
        page
    }) => {
        await page.locator('#settings-button').click();
        await expect(page.locator('#read-only')).toBeVisible();
        await expect(page.locator('#settings-button')).toHaveAttribute('aria-pressed', 'true');

        await page.locator('#help-button').click();

        await expect(page.locator('#help')).toBeVisible();
        await expect(page.locator('#read-only')).not.toBeVisible();
        await expect(page.locator('#settings-button')).toHaveAttribute('aria-pressed', 'false');
    });
});
