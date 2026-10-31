import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { addFreshStorageInitScript, waitForFreshStorage } from './indexedDbHelpers';
import { createTilePng, setTileResponse, selectDistantGroupPoints } from './imageExportTestHelpers';

test.describe('Image export from Share panel', () => {
    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await setTileResponse(page, await createTilePng(page));
        await page.goto('/');
        await waitForFreshStorage(page);
        const closeHelp = page.getByRole('button', { name: 'Close help panel' });
        if (await closeHelp.isVisible()) {
            await closeHelp.click();
            await expect(
                page.getByRole('dialog', { name: 'Using Safer Street Maker' })
            ).not.toBeAttached();
        }
        await page.addStyleTag({ content: '#help { display: none !important; }' });
        await page.waitForSelector('.toolbar');
    });

    test('downloads an exact-size PNG and restores the visible map after capture', async ({
        page
    }) => {
        await page.waitForFunction(() => {
            const tiles = Array.from(document.querySelectorAll<HTMLImageElement>('.leaflet-tile'));
            return (
                tiles.length > 0 && tiles.every((tile) => tile.complete && tile.naturalWidth > 0)
            );
        });

        const map = page.locator('#map');
        const originalStyle = await map.getAttribute('style');
        const originalBox = await map.boundingBox();
        expect(originalBox).not.toBeNull();

        await page.locator('#share-button').click();
        await page.locator('#export-as-image').click();
        await page.locator('#width').fill('320');
        await page.locator('#height').fill('280');

        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export PNG' }).click();
        const download = await downloadPromise;
        const outputPath = await download.path();
        expect(outputPath).not.toBeNull();
        const image = await readFile(outputPath!);

        expect(image.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
        expect(image.readUInt32BE(16)).toBe(320);
        expect(image.readUInt32BE(20)).toBe(280);

        const pixelStats = await page.evaluate(async (base64) => {
            const image = new Image();
            image.src = `data:image/png;base64,${base64}`;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext('2d');
            if (!context) {
                throw new Error('Canvas unavailable');
            }
            context.drawImage(image, 0, 0);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            const colors = new Set<string>();
            for (let index = 0; index < pixels.length; index += 4 * 12) {
                colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
            }
            return colors.size;
        }, image.toString('base64'));
        expect(pixelStats).toBeGreaterThan(8);

        await expect(map).toHaveAttribute('style', originalStyle ?? '');
        const restoredBox = await map.boundingBox();
        expect(restoredBox?.width).toBeCloseTo(originalBox!.width, 0);
        expect(restoredBox?.height).toBeCloseTo(originalBox!.height, 0);
        await expect(page.locator('[data-image-export-legend]')).not.toBeAttached();
    });

    test('exports a 2000x990 PNG when subpixel rounding puts the legend at the map edge', async ({
        page
    }) => {
        await page.waitForFunction(() => {
            const tiles = Array.from(document.querySelectorAll<HTMLImageElement>('.leaflet-tile'));
            return (
                tiles.length > 0 && tiles.every((tile) => tile.complete && tile.naturalWidth > 0)
            );
        });

        await page.locator('#share-button').click();
        await page.locator('#export-as-image').click();
        await page.locator('#width').fill('2000');
        await page.locator('#height').fill('990');

        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export PNG' }).click();
        const download = await downloadPromise;
        const outputPath = await download.path();
        expect(outputPath).not.toBeNull();
        const image = await readFile(outputPath!);

        expect(image.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
        expect(image.readUInt32BE(16)).toBe(2000);
        expect(image.readUInt32BE(20)).toBe(990);
    });

    test('reports failed map tiles and restores the map without downloading a partial image', async ({
        page
    }) => {
        await page.unroute('**/hot/**/*.png');
        await setTileResponse(page, Buffer.alloc(0), 403);
        await page.reload();
        await page.addStyleTag({ content: '#help { display: none !important; }' });
        await page.waitForSelector('.toolbar');
        const markers = await selectDistantGroupPoints(page);
        const originalVisibilities = await markers.evaluateAll((elements) =>
            elements.map((element) => getComputedStyle(element).visibility)
        );
        expect(originalVisibilities).toEqual(['hidden', 'hidden']);

        const map = page.locator('#map');
        const originalStyle = await map.getAttribute('style');
        const originalCenter = await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const center = app.config.globalProperties.$pinia._s.get('map').map.getCenter();
            return { lat: center.lat, lng: center.lng };
        });
        await page.locator('#share-button').click();
        await page.locator('#export-as-image').click();
        await page.locator('#width').fill('320');
        await page.locator('#height').fill('280');

        const downloadPromise = page.waitForEvent('download', { timeout: 1000 }).catch(() => null);
        await page.getByRole('button', { name: 'Export PNG' }).click();

        await expect(page.locator('#image-export-error')).toContainText('map image did not load');
        expect(await downloadPromise).toBeNull();
        await expect(map).toHaveAttribute('style', originalStyle ?? '');
        await expect(map).not.toHaveAttribute('aria-busy');
        await expect(map).not.toHaveAttribute('inert');
        await expect(page.locator('[data-image-export-legend]')).not.toBeAttached();
        await expect
            .poll(() =>
                markers.evaluateAll((elements) =>
                    elements.map((element) => getComputedStyle(element).visibility)
                )
            )
            .toEqual(originalVisibilities);
        const restoredCenter = await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const center = app.config.globalProperties.$pinia._s.get('map').map.getCenter();
            return { lat: center.lat, lng: center.lng };
        });
        expect(restoredCenter.lat).toBeCloseTo(originalCenter.lat, 3);
        expect(restoredCenter.lng).toBeCloseTo(originalCenter.lng, 3);
    });
});
