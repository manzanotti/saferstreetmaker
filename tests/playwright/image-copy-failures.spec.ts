import { expect, test } from '@playwright/test';
import { selectDistantGroupPoints } from './imageExportTestHelpers';
import { setupImageCopyTest, type TestRoot } from './imageCopyTestHelpers';

test.describe('Copy map image failures', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupImageCopyTest(page, context);
    });

    test('explains unavailable clipboard support without changing the map', async ({ page }) => {
        await page.evaluate(() => {
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
        });
        const originalStyle = await page.locator('#map').getAttribute('style');
        await page.locator('#share-button').click();
        await page.locator('#export-as-image').click();
        await page.getByRole('button', { name: 'Copy PNG' }).click();
        await expect(page.locator('#image-export-error')).toContainText('secure connection');
        await expect(page.locator('#map')).toHaveAttribute('style', originalStyle ?? '');
        await expect(page.locator('#map')).not.toHaveAttribute('aria-busy');
        await expect(page.locator('#image-copy-status')).toBeEmpty();
    });

    test('reports clipboard rejection only after restoring the map', async ({ page }) => {
        await page.evaluate(() => {
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: {
                    write: () => Promise.reject(new DOMException('Denied', 'NotAllowedError'))
                }
            });
        });
        const originalStyle = await page.locator('#map').getAttribute('style');
        await page.locator('#share-button').click();
        await page.locator('#export-as-image').click();
        await page.locator('#width').fill('640');
        await page.locator('#height').fill('400');
        await page.getByRole('button', { name: 'Copy PNG' }).click();
        await expect(page.locator('#image-export-error')).toContainText(
            'Clipboard access was denied'
        );
        await expect(page.locator('#map')).toHaveAttribute('style', originalStyle ?? '');
        await expect(page.locator('#map')).not.toHaveAttribute('aria-busy');
        await expect(page.getByRole('button', { name: 'Copy PNG' })).toBeEnabled();
        await expect(page.locator('#image-copy-status')).toBeEmpty();
    });

    test('restores group selection and view when rendering fails', async ({ page }) => {
        const markers = await selectDistantGroupPoints(page);
        const originalView = await page.evaluate(() => {
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: { write: () => Promise.resolve() }
            });
            const root = document.getElementById('app') as TestRoot | null;
            const map = root?.__vue_app__?.config.globalProperties.$pinia._s.get('map')?.map;
            if (!map) {
                throw new Error('Map is unavailable');
            }
            const center = map.getCenter();
            map.fitBounds = () => {
                throw new Error('Group framing failed');
            };
            return { lat: center.lat, lng: center.lng, zoom: map.getZoom() };
        });
        await page.locator('#share-button').click();
        await page.locator('#export-as-image').click();
        const originalStyle = await page.locator('#map').getAttribute('style');
        await page.getByRole('button', { name: 'Copy PNG' }).click();
        await expect(page.locator('#image-export-error')).toContainText('Group framing failed');
        await expect(page.locator('#map')).toHaveAttribute('style', originalStyle ?? '');
        await expect(page.locator('#map')).not.toHaveAttribute('aria-busy');
        await expect(page.locator('#image-copy-status')).toBeEmpty();
        await expect
            .poll(() =>
                markers.evaluateAll((elements) =>
                    elements.map((element) => getComputedStyle(element).visibility)
                )
            )
            .toEqual(['hidden', 'hidden']);
        const restoredView = await page.evaluate(() => {
            const root = document.getElementById('app') as TestRoot | null;
            const map = root?.__vue_app__?.config.globalProperties.$pinia._s.get('map')?.map;
            if (!map) {
                throw new Error('Map is unavailable');
            }
            const center = map.getCenter();
            return { lat: center.lat, lng: center.lng, zoom: map.getZoom() };
        });
        expect(restoredView.lat).toBeCloseTo(originalView.lat, 5);
        expect(restoredView.lng).toBeCloseTo(originalView.lng, 5);
        expect(restoredView.zoom).toBe(originalView.zoom);
    });

    test('blocks copy before accessing the clipboard while a map tool is active', async ({
        page
    }) => {
        await page.evaluate(() => {
            const state = window as Window & { clipboardWrites?: number };
            state.clipboardWrites = 0;
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: {
                    write: () => {
                        state.clipboardWrites = (state.clipboardWrites ?? 0) + 1;
                        return Promise.resolve();
                    }
                }
            });
        });
        await page.locator('#mobility-lane-button').click();
        await page.locator('#map').focus();
        await page.keyboard.press('Control+i');
        await expect(page.getByRole('dialog', { name: 'An error has occurred' })).toContainText(
            'Finish or cancel the active map tool'
        );
        expect(
            await page.evaluate(
                () => (window as Window & { clipboardWrites?: number }).clipboardWrites
            )
        ).toBe(0);
    });
});
