import { test, expect } from '@playwright/test';
import { addFreshStorageInitScript, waitForFreshStorage } from './indexedDbHelpers';

test.describe('Sharing Panel', () => {
    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
    });

    test('sharing panel is not visible on load', async ({ page }) => {
        await expect(page.locator('#sharing')).not.toBeAttached();
    });

    test('clicking share button opens the sharing panel', async ({ page }) => {
        await page.locator('#share-button').click();
        await expect(page.locator('#sharing')).toBeVisible();
    });

    test('pressing Escape closes the sharing panel', async ({ page }) => {
        await page.locator('#share-button').click();
        await page.locator('#width').press('Escape');

        await expect(page.locator('#sharing')).not.toBeAttached();
        await expect(page.locator('#share-button')).toBeFocused();
    });

    test('sharing format buttons replace the toggles and close from the header X', async ({
        page
    }) => {
        await expect(page.locator('#image-export-button')).not.toBeAttached();
        await page.locator('#share-button').click();
        await expect(page.locator('#export-as')).toContainText('Image');
        await expect(page.locator('#export-as')).toContainText('HTML');
        await expect(page.locator('#export-as')).toContainText('Url');
        await expect(page.locator('#export-as-html')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('#hide-toolbar')).not.toBeAttached();
        await expect(page.getByRole('button', { name: 'Close sharing panel' })).toBeVisible();
        await expect(page.locator('#html-export-description')).toBeVisible();

        await page.locator('#export-as-image').click();

        await expect(page.locator('#image-export-description')).toBeVisible();
        await expect(page.locator('#width')).toBeVisible();
        await expect(page.locator('#height')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Export PNG' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Copy PNG' })).toBeVisible();

        await page.locator('#export-as-url').click();
        await expect(page.locator('#url-export-description')).toBeVisible();

        await page.getByRole('button', { name: 'Close sharing panel' }).click();
        await expect(page.locator('#sharing')).not.toBeAttached();
    });

    test('hidden imported layers are excluded from the shared URL', async ({ page }) => {
        await page.evaluate(() => {
            (window as any).__clipboardText = '';
            navigator.clipboard.writeText = async (text: string) => {
                (window as any).__clipboardText = text;
            };
        });

        await page.locator('#share-button').click();
        await page.locator('#width').fill('320');
        await page.locator('#height').fill('240');
        await page.locator('button:has-text("Create")').click();

        const hiddenShareLength = await page.evaluate(() => {
            const src = (window as any).__clipboardText.match(/src="([^"]+)"/)?.[1] ?? '';
            return src.length;
        });

        await page.locator('#sharing button[aria-label="Close sharing panel"]').click();
        await page.locator('#layers-button').click();
        await page.getByLabel('Show layer Birmingham Wards').click();
        await expect(page.getByLabel('Hide layer Birmingham Wards')).toBeVisible();
        await page.getByLabel('Close layers').click();

        await page.locator('#share-button').click();
        await page.locator('#width').fill('320');
        await page.locator('#height').fill('240');
        await page.locator('button:has-text("Create")').click();

        const visibleShareLength = await page.evaluate(() => {
            const src = (window as any).__clipboardText.match(/src="([^"]+)"/)?.[1] ?? '';
            return src.length;
        });

        // The hidden default layer must not be embedded, so the URL stays short.
        expect(hiddenShareLength).toBeLessThan(2000);
        expect(visibleShareLength).toBeGreaterThan(hiddenShareLength);
    });

    test('sharing panel defaults to the displayed map dimensions', async ({ page }) => {
        const mapBox = await page.locator('#map').boundingBox();
        expect(mapBox).not.toBeNull();

        await page.locator('#share-button').click();
        await expect(page.locator('#sharing')).toBeVisible();

        if (mapBox) {
            await expect(page.locator('#width')).toHaveValue(String(Math.round(mapBox.width)));
            await expect(page.locator('#height')).toHaveValue(String(Math.round(mapBox.height)));
        }
    });

    test('clicking share button a second time closes the sharing panel', async ({ page }) => {
        const button = page.locator('#share-button');
        await button.click(); // open
        await expect(page.locator('#sharing')).toBeVisible();
        await button.click(); // close
        await expect(page.locator('#sharing')).not.toBeAttached();
    });

    test('format selector stays inside the sharing panel bounds', async ({ page }) => {
        await page.locator('#share-button').click();

        const selectorBox = await page.locator('#export-as').boundingBox();
        const panelBox = await page.locator('#sharing').boundingBox();

        expect(selectorBox).not.toBeNull();
        expect(panelBox).not.toBeNull();

        if (selectorBox && panelBox) {
            expect(selectorBox.x).toBeGreaterThanOrEqual(panelBox.x);
            expect(selectorBox.x + selectorBox.width).toBeLessThanOrEqual(
                panelBox.x + panelBox.width
            );
            expect(selectorBox.y).toBeGreaterThanOrEqual(panelBox.y);
            expect(selectorBox.y + selectorBox.height).toBeLessThanOrEqual(
                panelBox.y + panelBox.height
            );
        }
    });

    test('Url mode copies a direct share link', async ({ page }) => {
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
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');

        await page.locator('#share-button').click();
        await page.locator('#export-as-url').click();
        await page.getByRole('button', { name: 'Create' }).click();

        await expect(page.locator('#messageRow')).toBeVisible();
        const copiedText = await page.evaluate(() => (window as any).__clipboardText as string);
        expect(copiedText).not.toContain('<iframe');

        const shareUrl = new URL(copiedText);
        expect(shareUrl.searchParams.get('share')).toBe('1');
        expect(shareUrl.searchParams.get('hide-toolbar')).toBe('false');
        expect(shareUrl.hash.length).toBeGreaterThan(1);
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
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');

        await page.locator('#share-button').click();
        await page.locator('#width').fill('320');
        await page.locator('#height').fill('240');
        await page.locator('button:has-text("Create")').click();

        await expect(page.locator('#messageRow')).toBeVisible();
        const iframeUrl = await page.evaluate(
            () => (window as any).__clipboardText.match(/src="([^"]+)"/)?.[1] as string
        );
        const params = new URL(iframeUrl).searchParams;
        expect(params.get('share')).toBe('1');
        expect(params.has('group')).toBe(false);
        expect(params.has('version')).toBe(false);
    });

    test('clicking the share Close button closes the sharing panel', async ({ page }) => {
        await page.locator('#share-button').click();
        await page.getByRole('button', { name: 'Close sharing panel' }).click();
        await expect(page.locator('#sharing')).not.toBeAttached();
    });
});
