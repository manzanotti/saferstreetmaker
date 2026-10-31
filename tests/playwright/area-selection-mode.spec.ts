import { test, expect } from '@playwright/test';
import { setupPage, drawMobilityLane } from './areaSelectionTestHelpers';

test.describe('Area selection — button', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('select-area button is present in the undo toolbar', async ({ page }) => {
        await expect(page.locator('#select-area-button')).toBeVisible();
    });

    test('button starts inactive (aria-pressed = false)', async ({ page }) => {
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'false');
    });

    test('clicking the button activates area-select mode (aria-pressed = true)', async ({
        page
    }) => {
        await page.locator('#select-area-button').click();
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'true');
    });

    test('clicking the active button deactivates mode', async ({ page }) => {
        await page.locator('#select-area-button').click();
        await page.locator('#select-area-button').click();
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'false');
    });

    test('area-select CSS class is added to #map when active', async ({ page }) => {
        await page.locator('#select-area-button').click();
        await expect(page.locator('#map')).toHaveClass(/area-select/);
    });

    test('area-select CSS class is removed from #map when deactivated', async ({ page }) => {
        await page.locator('#select-area-button').click();
        await page.locator('#select-area-button').click();
        const classes = await page.locator('#map').getAttribute('class');
        expect(classes ?? '').not.toContain('area-select');
    });
});

test.describe('Area selection — handle cleanup on edit-mode exit', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('circle vertex handles disappear after Escape exits polyline edit mode', async ({
        page
    }) => {
        await drawMobilityLane(page);
        await page.locator('#mobility-lane-button').click(); // deactivate draw tool

        const path = page.locator('.leaflet-overlay-pane path.leaflet-interactive');

        // Normal click opens popup + speculatively pre-selects the polyline
        await path.first().dispatchEvent('click');
        await page.waitForSelector('.popup-buttons');

        // Press Escape — edit mode exits; the pre-selection must be cleaned up
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);

        // The area-selection panel must NOT show (selection was cleared)
        await expect(page.getByText('feature selected', { exact: false })).not.toBeVisible();

        // A subsequent Shift-click should result in exactly 1 feature selected,
        // confirming the prior pre-selection was discarded and not accumulated.
        await path.first().dispatchEvent('click', { shiftKey: true });
        await page.waitForTimeout(200);
        await expect(page.getByText('1 feature selected')).toBeVisible();
    });
});
