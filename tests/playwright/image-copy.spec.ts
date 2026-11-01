import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { selectDistantGroupPoints } from './imageExportTestHelpers';
import { compareClipboardWithPng, setupImageCopyTest, type TestRoot } from './imageCopyTestHelpers';

test.describe('Copy map image', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupImageCopyTest(page, context);
    });

    test('copies the same group-framed PNG as file export and supports Ctrl+I', async ({
        page
    }) => {
        test.setTimeout(60_000);
        const markers = await selectDistantGroupPoints(page);
        const originalView = await page.evaluate(() => {
            const root = document.getElementById('app') as TestRoot | null;
            const stores = root?.__vue_app__?.config.globalProperties.$pinia._s;
            const map = stores?.get('map')?.map;
            const selected = stores?.get('selection')?.selected;
            if (!map || !selected) {
                throw new Error('Map or selection is unavailable');
            }
            const state = window as Window & { groupFitObserved?: boolean };
            state.groupFitObserved = false;
            map.on('moveend', () => {
                if (
                    stores?.get('ui')?.imageExportInProgress &&
                    selected.every(({ latLng }) => map.getBounds().contains(latLng))
                ) {
                    state.groupFitObserved = true;
                }
            });
            const center = map.getCenter();
            return { lat: center.lat, lng: center.lng, zoom: map.getZoom() };
        });

        await page.locator('#share-button').click();
        await page.locator('#export-as-image').click();
        await page.locator('#width').fill('640');
        await page.locator('#height').fill('400');
        const panelStyle = await page.locator('#map').getAttribute('style');
        await page.getByRole('button', { name: 'Copy PNG' }).click();
        await expect(page.locator('#image-copy-status')).toContainText(
            'Map image copied to clipboard.',
            { timeout: 20_000 }
        );
        await expect(page.locator('#map')).not.toHaveAttribute('aria-busy');
        await expect(page.locator('#map')).toHaveAttribute('style', panelStyle ?? '');
        expect(
            await page.evaluate(
                () => (window as Window & { groupFitObserved?: boolean }).groupFitObserved
            )
        ).toBe(true);

        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export PNG' }).click();
        const download = await downloadPromise;
        const filePath = await download.path();
        if (!filePath) {
            throw new Error('PNG download was not saved');
        }
        const downloaded = await readFile(filePath);
        await expect(page.locator('#map')).not.toHaveAttribute('aria-busy');

        const comparison = await compareClipboardWithPng(page, downloaded.toString('base64'));
        expect(comparison.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
        expect([comparison.width, comparison.height]).toEqual([640, 400]);
        expect([comparison.fileWidth, comparison.fileHeight]).toEqual([640, 400]);
        expect(comparison.differentPixels, JSON.stringify(comparison)).toBe(0);

        await page.getByRole('button', { name: 'Close sharing panel' }).click();
        await expect(page.locator('#image-copy-status')).toBeEmpty({ timeout: 6000 });
        const mapDimensions = await page
            .locator('#map')
            .evaluate((element) => [element.clientWidth, element.clientHeight]);
        await page.locator('#map').focus();
        const shortcutStyle = await page.locator('#map').evaluate((element: HTMLElement) => ({
            width: element.style.width,
            height: element.style.height,
            pointerEvents: element.style.pointerEvents,
            inert: element.inert
        }));
        await page.keyboard.press('Control+i');
        await expect(page.locator('#image-copy-status')).toContainText(
            'Map image copied to clipboard.',
            { timeout: 20_000 }
        );
        const shortcutDimensions = await page.evaluate(async () => {
            const item = (await navigator.clipboard.read()).find((entry) =>
                entry.types.includes('image/png')
            );
            if (!item) {
                throw new Error('The shortcut did not copy a PNG');
            }
            const bitmap = await createImageBitmap(await item.getType('image/png'));
            return [bitmap.width, bitmap.height];
        });
        expect(shortcutDimensions).toEqual(mapDimensions);
        await expect
            .poll(() =>
                page.locator('#map').evaluate((element: HTMLElement) => ({
                    width: element.style.width,
                    height: element.style.height,
                    pointerEvents: element.style.pointerEvents,
                    inert: element.inert
                }))
            )
            .toEqual(shortcutStyle);
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
        await expect(page.locator('#image-copy-status')).toBeEmpty({ timeout: 6000 });
    });
});
