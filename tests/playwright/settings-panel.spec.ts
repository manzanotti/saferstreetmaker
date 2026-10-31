import { test, expect } from '@playwright/test';
import { addFreshStorageInitScript, waitForFreshStorage } from './indexedDbHelpers';

test.describe('Settings Panel', () => {
    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
    });

    test('settings panel is not visible on load', async ({ page }) => {
        // The settings panel contains a unique #read-only checkbox
        await expect(page.locator('#read-only')).not.toBeAttached();
    });

    test('clicking settings button opens the settings panel', async ({ page }) => {
        await page.locator('#settings-button').click();
        await expect(page.locator('#read-only')).toBeVisible();
    });

    test('settings uses the highest overlay stacking order', async ({ page }) => {
        await page.locator('#groups-button').click();
        await expect(page.locator('#groups-panel-title')).toBeVisible();

        await page.locator('#settings-button').click();

        const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
        await expect(settingsDialog).toBeVisible();
        await expect(settingsDialog).toHaveCSS('z-index', '10002');
    });

    test('clicking settings button a second time closes the settings panel', async ({ page }) => {
        const settingsButton = page.locator('#settings-button');
        await settingsButton.click(); // open
        await expect(page.locator('#read-only')).toBeVisible();
        await settingsButton.click(); // close
        await expect(page.locator('#read-only')).not.toBeAttached();
    });

    test('clicking the settings Save button saves and closes the panel', async ({ page }) => {
        await page.locator('#settings-button').click();
        await page.locator('#title').fill('Saved Title');
        await page.locator('button:has-text("Save")').click();
        await expect(page.locator('#read-only')).not.toBeAttached();
        await expect(page.locator('#settings-button')).toBeVisible();
    });

    test('clicking the settings header X closes without saving', async ({ page }) => {
        await page.locator('#settings-button').click();
        await page.getByRole('button', { name: 'Close settings panel' }).click();
        await expect(page.locator('#read-only')).not.toBeAttached();
    });

    test('pressing Escape closes the settings panel', async ({ page }) => {
        await page.locator('#settings-button').click();
        await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            app.config.globalProperties.$pinia._s.get('map').activeLayerId = 'ltn';
        });
        await page.locator('#title').press('Escape');

        await expect(page.locator('#read-only')).not.toBeAttached();
        await expect(page.locator('#settings-button')).toBeFocused();
        const activeLayerId = await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            return app.config.globalProperties.$pinia._s.get('map').activeLayerId;
        });
        expect(activeLayerId).toBe('ltn');
    });

    test('Escape does not close a panel or cancel map tools behind an error dialog', async ({
        page
    }) => {
        await page.locator('#settings-button').click();
        await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app.config.globalProperties.$pinia;
            pinia._s.get('map').activeLayerId = 'ltn';
            pinia._s.get('ui').showErrors(['A recoverable test error.']);
        });

        const errorDialog = page.getByRole('dialog', { name: 'An error has occurred' });
        await expect(errorDialog).toBeVisible();
        await errorDialog.getByRole('button', { name: 'Dismiss' }).focus();
        await page.keyboard.press('Escape');

        await expect(page.locator('#read-only')).toBeVisible();
        await expect(errorDialog).toBeVisible();
        const activeLayerId = await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            return app.config.globalProperties.$pinia._s.get('map').activeLayerId;
        });
        expect(activeLayerId).toBe('ltn');
    });

    test('a lost Escape keyup after closing a panel does not swallow the next Escape', async ({
        page
    }) => {
        await page.locator('#settings-button').click();
        await expect(page.locator('#read-only')).toBeVisible();
        await page.locator('#title').dispatchEvent('keydown', { key: 'Escape', bubbles: true });
        await expect(page.locator('#read-only')).not.toBeAttached();

        await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            app.config.globalProperties.$pinia._s.get('map').activeLayerId = 'ModalFilters';
        });
        await page.locator('#map').focus();
        await page.keyboard.press('Escape');

        await expect
            .poll(() =>
                page.evaluate(() => {
                    const app = (document.getElementById('app') as any).__vue_app__;
                    return app.config.globalProperties.$pinia._s.get('map').activeLayerId;
                })
            )
            .toBeNull();
    });

    test('double-clicking a panel control does not zoom the map', async ({ page }) => {
        await page.locator('#settings-button').click();
        await expect(page.getByText('Visible Layers')).toBeVisible();

        const map = page.locator('#map');
        const initialZoom = await map.evaluate(
            (element) =>
                Array.from(element.classList).find((className) => className.startsWith('zoom-')) ??
                ''
        );

        await page.getByRole('button', { name: 'Close settings panel' }).dblclick();

        await page.waitForTimeout(200);

        const zoomAfter = await map.evaluate(
            (element) =>
                Array.from(element.classList).find((className) => className.startsWith('zoom-')) ??
                ''
        );

        expect(zoomAfter).toBe(initialZoom);
    });

    test('layer toggle switches are aligned to the right of their labels', async ({ page }) => {
        await page.locator('#settings-button').click();

        const label = page.locator('label[for="ModalFilters"]');
        const toggle = page.locator('#ModalFilters');
        const labelBox = await label.boundingBox();
        const toggleBox = await toggle.boundingBox();

        expect(labelBox).not.toBeNull();
        expect(toggleBox).not.toBeNull();

        if (labelBox && toggleBox) {
            expect(toggleBox.x).toBeGreaterThan(labelBox.x + labelBox.width);
        }
    });
});
