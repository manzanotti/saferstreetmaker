import { test, expect } from '@playwright/test';
import { addFirstNavigationStorageResetScript, waitForFreshStorage } from './indexedDbHelpers';

test.describe('Reload Persistence', () => {
    // Storage is wiped only on the first navigation so the reload below behaves
    // like a real return visit rather than a fresh install.
    test.beforeEach(async ({ page }) => {
        await addFirstNavigationStorageResetScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
    });

    test('deleting the final imported layer survives reload', async ({ page }) => {
        await page.locator('#layers-button').click();
        await expect(page.getByLabel('Delete Birmingham Wards')).toBeVisible();
        await page.getByLabel('Delete Birmingham Wards').click();
        await expect(page.locator('#layers-empty')).toBeVisible();
        await expect(page.locator('#undo-button')).toBeEnabled();

        await page.reload();
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');

        await page.locator('#layers-button').click();
        await expect(page.locator('#layers-empty')).toBeVisible();
        await expect(page.getByLabel('Open layer Birmingham Wards')).not.toBeAttached();
    });

    test('the default imported layer is restored after reload when it is kept', async ({
        page
    }) => {
        await page.locator('#layers-button').click();
        await expect(page.getByLabel('Open layer Birmingham Wards')).toBeVisible();
        await page.getByLabel('Close layers').click();

        await page.locator('#settings-button').click();
        await page.locator('#title').fill('Kept Wards Map');
        await page.locator('button:has-text("Save")').click();
        await expect(page.locator('#undo-button')).toBeEnabled();

        await page.reload();
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');

        await page.locator('#layers-button').click();
        await expect(page.getByLabel('Open layer Birmingham Wards')).toBeVisible();
    });

    test('saving Birmingham preserves LTN cells through undo, redo and reload', async ({
        page
    }) => {
        await page.goto('/?map=Birmingham.json');
        await expect(page.locator('.leaflet-ltns-pane path')).toHaveCount(80);

        await page.locator('#settings-button').click();
        await page.locator('#title').fill('Birmingham Saved');
        await page.locator('button:has-text("Save")').click();
        await expect(page.locator('#undo-button')).toBeEnabled();
        await expect(page.locator('.leaflet-ltns-pane path')).toHaveCount(80);

        await page.locator('#undo-button').click();
        await expect(page.locator('#redo-button')).toBeEnabled();
        await expect(page.locator('.leaflet-ltns-pane path')).toHaveCount(80);

        await page.locator('#redo-button').click();
        await expect(page.locator('.leaflet-ltns-pane path')).toHaveCount(80);
        await page.goto('/');
        await waitForFreshStorage(page);
        await expect(page.locator('.leaflet-ltns-pane path')).toHaveCount(80);
    });

    test('Escape from the layer rename input returns to layers before closing the panel', async ({
        page
    }) => {
        await page.locator('#layers-button').click();
        await page.getByLabel('Open layer Birmingham Wards').click();
        const renameInput = page.getByLabel('Rename Birmingham Wards');
        await renameInput.click();
        await renameInput.press('Escape');
        await expect(page.getByLabel('Open layer Birmingham Wards')).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(page.locator('#layers-panel')).not.toBeAttached();
    });

    test('a disabled layer stays disabled after reload', async ({ page }) => {
        await page.locator('#settings-button').click();
        await page.locator('#BusLanes').uncheck();
        await page.locator('button:has-text("Save")').click();
        await expect(page.locator('#bus-lane-button')).not.toBeVisible();
        await expect(page.locator('#undo-button')).toBeEnabled();

        await page.reload();
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');

        await page.locator('#settings-button').click();
        await expect(page.locator('#BusLanes')).not.toBeChecked();
    });
});
