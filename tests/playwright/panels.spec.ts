import { test, expect } from '@playwright/test';
import { addFreshStorageInitScript, seedStoredMap } from './indexedDbHelpers';

test.describe('Settings Panel', () => {
    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await page.goto('/');
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

    test('clicking the settings Cancel button closes the panel', async ({ page }) => {
        await page.locator('#settings-button').click();
        await page.locator('button:has-text("Cancel")').click();
        await expect(page.locator('#read-only')).not.toBeAttached();
    });

    test('double-clicking a modal control does not zoom the map', async ({ page }) => {
        await page.locator('#settings-button').click();
        await expect(page.getByText('Visible Layers')).toBeVisible();

        const map = page.locator('#map');
        const initialZoom = await map.evaluate(
            (element) =>
                Array.from(element.classList).find((className) => className.startsWith('zoom-')) ??
                ''
        );

        await page.locator('button:has-text("Cancel")').dblclick();

        await page.waitForTimeout(200);

        const zoomAfter = await map.evaluate(
            (element) =>
                Array.from(element.classList).find((className) => className.startsWith('zoom-')) ??
                ''
        );

        expect(zoomAfter).toBe(initialZoom);
    });
});

test.describe('Map Manager Panel', () => {
    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await page.goto('/');
        await page.waitForSelector('.toolbar');
    });

    test('map manager panel is not visible on load', async ({ page }) => {
        await expect(page.locator('#map-manager')).not.toBeAttached();
    });

    test('clicking map manager button opens the panel', async ({ page }) => {
        await page.locator('#map-manager-button').click();
        await expect(page.locator('#map-manager')).toBeVisible();
    });

    test('clicking map manager button a second time closes the panel', async ({ page }) => {
        const button = page.locator('#map-manager-button');
        await button.click(); // open
        await expect(page.locator('#map-manager')).toBeVisible();
        await button.click(); // close
        await expect(page.locator('#map-manager')).not.toBeAttached();
    });

    test('clicking the new map control reveals the create-map form', async ({ page }) => {
        await page.locator('#map-manager-button').click();
        await page.locator('#new-map').click();
        await expect(page.locator('#create-new-map')).toBeVisible();
    });

    test('clicking the copy map control creates another stored map entry', async ({ page }) => {
        await seedStoredMap(page, 'Hello Cleveland');

        await page.locator('#map-manager-button').click();
        await page.locator('#copy-map').click();

        await expect(page.locator('#map-list li')).toHaveCount(2);
    });

    test('clicking create in the new map form shows the duplicate-title error for existing names', async ({
        page
    }) => {
        await seedStoredMap(page, 'Hello Cleveland');

        await page.locator('#map-manager-button').click();
        await page.locator('#new-map').click();
        await page.locator('#new-map-title').fill('Hello Cleveland');
        await page.locator('#create-new-map button').click();

        await expect(page.locator('#duplicate-title-error')).toContainText(
            'You already have a map named Hello Cleveland'
        );
    });
});

test.describe('Sharing Panel', () => {
    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await page.goto('/');
        await page.waitForSelector('.toolbar');
    });

    test('sharing panel is not visible on load', async ({ page }) => {
        await expect(page.locator('#sharing')).not.toBeAttached();
    });

    test('clicking share button opens the sharing panel', async ({ page }) => {
        await page.locator('#share-button').click();
        await expect(page.locator('#sharing')).toBeVisible();
    });

    test('clicking share button a second time closes the sharing panel', async ({ page }) => {
        const button = page.locator('#share-button');
        await button.click(); // open
        await expect(page.locator('#sharing')).toBeVisible();
        await button.click(); // close
        await expect(page.locator('#sharing')).not.toBeAttached();
    });

    test('share toggle stays inside the sharing panel bounds', async ({ page }) => {
        await page.locator('#share-button').click();

        const toggleBox = await page.locator('#hide-toolbar').boundingBox();
        const panelBox = await page.locator('#sharing').boundingBox();

        expect(toggleBox).not.toBeNull();
        expect(panelBox).not.toBeNull();

        if (toggleBox && panelBox) {
            expect(toggleBox.x).toBeGreaterThanOrEqual(panelBox.x);
            expect(toggleBox.x + toggleBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width);
            expect(toggleBox.y).toBeGreaterThanOrEqual(panelBox.y);
            expect(toggleBox.y + toggleBox.height).toBeLessThanOrEqual(
                panelBox.y + panelBox.height
            );
        }
    });

    test('clicking the share Create button shows the copied-message path', async ({ page }) => {
        await page.addInitScript(() => {
            (window as any).__clipboardText = '';
            Object.defineProperty(navigator, 'clipboard', {
                value: {
                    writeText: (text: string) => (
                        ((window as any).__clipboardText = text),
                        Promise.resolve()
                    )
                },
                configurable: true
            });
        });
        await page.goto('/');
        await page.waitForSelector('.toolbar');

        await page.locator('#share-button').click();
        await page.locator('#width').fill('320');
        await page.locator('#height').fill('240');
        await page.locator('button:has-text("Create")').click();

        await expect(page.locator('#messageRow')).toBeVisible();
        await expect(page.evaluate(() => (window as any).__clipboardText)).resolves.toContain(
            'iframe'
        );
    });

    test('clicking the share Close button closes the sharing panel', async ({ page }) => {
        await page.locator('#share-button').click();
        await page.locator('#sharing button:has-text("Close")').click();
        await expect(page.locator('#sharing')).not.toBeAttached();
    });
});
