import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { addFreshStorageInitScript, waitForFreshStorage } from './indexedDbHelpers';

async function createTilePng(page: import('@playwright/test').Page): Promise<Buffer> {
    const base64 = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Canvas unavailable');
        }
        for (let y = 0; y < 32; y += 4) {
            for (let x = 0; x < 32; x += 4) {
                context.fillStyle = `hsl(${(x * 17 + y * 31) % 360} 65% 60%)`;
                context.fillRect(x, y, 4, 4);
            }
        }
        return canvas.toDataURL('image/png').split(',')[1];
    });
    return Buffer.from(base64, 'base64');
}

async function setTileResponse(
    page: import('@playwright/test').Page,
    tilePng: Buffer,
    status = 200
) {
    await page.route('**/hot/**/*.png', async (route) => {
        await route.fulfill({
            status,
            contentType: status === 200 ? 'image/png' : 'text/html',
            headers: { 'access-control-allow-origin': '*' },
            body: status === 200 ? tilePng : 'Tile request failed'
        });
    });
}

test.describe('Image export from Share panel', () => {
    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await setTileResponse(page, await createTilePng(page));
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.addStyleTag({ content: '#help { display: none !important; }' });
        await page.waitForSelector('.toolbar');
    });

    test('direct URL sharing does not require image dimensions', async ({ page }) => {
        await page.evaluate(() => {
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: {
                    writeText: (text: string) => (
                        ((window as any).__clipboardText = text),
                        Promise.resolve()
                    )
                }
            });
        });

        await page.locator('#share-button').click();
        await page.locator('#export-as-url').click();

        await expect(page.locator('#width')).not.toBeAttached();
        await expect(page.locator('#height')).not.toBeAttached();
        await expect(page.getByRole('button', { name: 'Create' })).toBeEnabled();
        await page.getByRole('button', { name: 'Create' }).click();

        await expect(page.locator('#messageRow')).toBeVisible();
        const clipboardText = await page.evaluate(() => (window as any).__clipboardText);
        expect(clipboardText).toContain('share=1');
        expect(clipboardText).not.toContain('<iframe');
    });

    test('renders a static export legend and omits it when there are no export entries', async ({
        page
    }) => {
        await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            app.config.globalProperties.$pinia._s
                .get('ui')
                .setImageExportState(true, new Set(['LtnCells']));
        });

        const legend = page.locator('[data-image-export-legend]');
        await expect(legend).toBeVisible();
        await expect(legend.locator('li').first()).not.toHaveAttribute('role', 'button');

        await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            app.config.globalProperties.$pinia._s.get('ui').setImageExportState(true, new Set());
        });
        await expect(legend).not.toBeAttached();

        await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            app.config.globalProperties.$pinia._s.get('ui').setImageExportState(false, null);
        });
    });

    test('uses the sharing panel dimensions and closes from the toolbar', async ({ page }) => {
        const mapBox = await page.locator('#map').boundingBox();
        expect(mapBox).not.toBeNull();

        const shareButton = page.locator('#share-button');
        await shareButton.click();
        const dialog = page.getByRole('dialog', { name: 'Share map' });
        await expect(dialog).toBeVisible();

        if (mapBox) {
            await expect(page.locator('#width')).toHaveValue(String(Math.round(mapBox.width)));
            await expect(page.locator('#height')).toHaveValue(String(Math.round(mapBox.height)));
        }

        await shareButton.click();
        await expect(dialog).not.toBeAttached();
    });

    test('rejects dimensions outside the export limits', async ({ page }) => {
        await page.locator('#share-button').click();
        await page.locator('#export-as-image').click();
        await page.locator('#width').fill('255');

        await expect(page.locator('#image-export-error')).toContainText('between 256 and 8192');
        await expect(page.getByRole('button', { name: 'Export PNG' })).toBeDisabled();
    });

    test('refuses to export while a map tool is active', async ({ page }) => {
        await page.locator('#share-button').click();
        await page.locator('#export-as-image').click();
        await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            app.config.globalProperties.$pinia._s.get('map').activeLayerId = 'ltn';
        });

        const downloadPromise = page.waitForEvent('download', { timeout: 1000 }).catch(() => null);
        await page.getByRole('button', { name: 'Export PNG' }).click();

        await expect(page.locator('#image-export-error')).toContainText(
            'Finish or cancel the active map tool before exporting.'
        );
        expect(await downloadPromise).toBeNull();
        await expect(page.locator('#map')).not.toHaveAttribute('aria-busy');
    });

    test('rejects a concurrent image export transaction', async ({ page }) => {
        const downloadPromise = page.waitForEvent('download');
        const duplicateError = await page.evaluate(async () => {
            const modulePath = '/features/export/mapImageExport.ts';
            const { exportMapAsPng } = await import(/* @vite-ignore */ modulePath);
            const firstExport = exportMapAsPng(320, 280);
            let message = '';
            try {
                await exportMapAsPng(320, 280);
            } catch (error) {
                message = error instanceof Error ? error.message : String(error);
            }
            await firstExport;
            return message;
        });

        expect(duplicateError).toBe('An image export is already in progress.');
        await downloadPromise;
    });

    test('reports when the complete export legend does not fit the image', async ({ page }) => {
        await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app.config.globalProperties.$pinia;
            const mapStore = pinia._s.get('map');
            const map = mapStore.map;
            const bounds = map.getBounds();
            const southWest = bounds.getSouthWest();
            const northEast = bounds.getNorthEast();
            const feature = (window as any).L.polygon([
                [southWest.lat, southWest.lng],
                [southWest.lat, northEast.lng],
                [northEast.lat, northEast.lng],
                [northEast.lat, southWest.lng]
            ]);
            mapStore.layers
                .find((layer: any) => layer.id === 'LtnCells')
                .getLayer()
                .addLayer(feature);
        });
        await page.addStyleTag({
            content: '.image-export-legend { min-width: 600px !important; }'
        });

        await page.locator('#share-button').click();
        await page.locator('#export-as-image').click();
        await page.locator('#width').fill('256');
        await page.locator('#height').fill('256');
        await page.getByRole('button', { name: 'Export PNG' }).click();

        await expect(page.locator('#image-export-error')).toContainText(
            'Increase the image dimensions to fit the complete legend.'
        );
        await expect(page.locator('#map')).not.toHaveAttribute('aria-busy');
        await expect(page.locator('#map')).not.toHaveAttribute('inert');
        await expect(page.locator('[data-image-export-legend]')).not.toBeAttached();
    });

    test('keeps the map center and loads tiles for an expanded export', async ({ page }) => {
        await page.waitForFunction(() => {
            const tiles = Array.from(document.querySelectorAll<HTMLImageElement>('.leaflet-tile'));
            return (
                tiles.length > 0 && tiles.every((tile) => tile.complete && tile.naturalWidth > 0)
            );
        });

        await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const map = app.config.globalProperties.$pinia._s.get('map').map;
            const icon = (window as any).L.divIcon({
                className: 'export-center-probe',
                html: '<div style="width:20px;height:20px;background:#ff0000"></div>',
                iconAnchor: [10, 10],
                iconSize: [20, 20]
            });
            (window as any).L.marker(map.getCenter(), { icon }).addTo(map);

            const brokenControlImage = document.createElement('img');
            brokenControlImage.src = 'data:image/png;base64,broken';
            map.getContainer().querySelector('.leaflet-control')?.append(brokenControlImage);

            const controlProbe = document.createElement('div');
            controlProbe.id = 'export-control-probe';
            controlProbe.style.cssText =
                'position:fixed;left:24px;top:24px;width:16px;height:16px;background:#ff00ff;z-index:2147483647';
            map.getContainer().querySelector('.leaflet-control')?.append(controlProbe);
        });
        const controlProbePoint = await page.evaluate(() => {
            const probe = document.getElementById('export-control-probe')!;
            const mapRect = document.getElementById('map')!.getBoundingClientRect();
            const rect = probe.getBoundingClientRect();
            return {
                x: Math.floor(rect.left - mapRect.left + rect.width / 2),
                y: Math.floor(rect.top - mapRect.top + rect.height / 2)
            };
        });

        const tileRequestUrls = new Set<string>();
        let releaseFirstTile: (() => void) | undefined;
        let didStallTile = false;
        const tilePng = await createTilePng(page);
        await page.unroute('**/hot/**/*.png');
        await page.route('**/hot/**/*.png', async (route) => {
            if (!didStallTile) {
                didStallTile = true;
                await new Promise<void>((resolve) => {
                    releaseFirstTile = resolve;
                });
            }
            await route.fulfill({
                status: 200,
                contentType: 'image/png',
                headers: { 'access-control-allow-origin': '*' },
                body: tilePng
            });
        });
        page.on('request', (request) => {
            if (request.url().includes('/hot/') && request.url().endsWith('.png')) {
                tileRequestUrls.add(request.url());
            }
        });

        await page.locator('#share-button').click();
        await page.locator('#export-as-image').click();
        await page.locator('#width').fill('3200');
        await page.locator('#height').fill('1800');

        const originalCenter = await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const map = app.config.globalProperties.$pinia._s.get('map').map;
            const center = map.getCenter();
            return { lat: center.lat, lng: center.lng, zoom: map.getZoom() };
        });
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export PNG' }).click();
        await page.waitForFunction(() => document.querySelector('#map')?.getAttribute('aria-busy'));
        const interactionState = await page.evaluate(() => {
            const map = document.querySelector<HTMLElement>('#map');
            const areaButton = document.querySelector<HTMLButtonElement>('#select-area-button');
            areaButton?.focus();
            return {
                mapIsInert: map?.inert,
                areaButtonReceivedFocus: document.activeElement === areaButton
            };
        });
        expect(interactionState.mapIsInert).toBe(true);
        expect(interactionState.areaButtonReceivedFocus).toBe(false);
        await expect.poll(() => didStallTile).toBe(true);
        const expandedTileCount = await page.locator('#map .leaflet-tile').count();
        const tileUrlsBeforeRestore = tileRequestUrls.size;
        const completedBeforeTileLoad = await Promise.race([
            downloadPromise.then(() => true),
            page.waitForTimeout(200).then(() => false)
        ]);
        expect(completedBeforeTileLoad).toBe(false);
        releaseFirstTile?.();
        const exportCenter = await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const map = app.config.globalProperties.$pinia._s.get('map').map;
            const center = map.getCenter();
            return {
                center: { lat: center.lat, lng: center.lng },
                size: map.getSize()
            };
        });
        const download = await downloadPromise;
        const outputPath = await download.path();
        expect(outputPath).not.toBeNull();
        const restoredView = await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const map = app.config.globalProperties.$pinia._s.get('map').map;
            const center = map.getCenter();
            return {
                center: { lat: center.lat, lng: center.lng },
                zoom: map.getZoom(),
                size: map.getSize()
            };
        });

        const centerPixel = await page.evaluate(
            async ({ base64, controlProbePoint }) => {
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
                return {
                    centerPixel: [...context.getImageData(1600, 900, 1, 1).data],
                    cornerPixel: [...context.getImageData(3190, 1790, 1, 1).data],
                    controlPixel: [
                        ...context.getImageData(controlProbePoint.x, controlProbePoint.y, 1, 1).data
                    ]
                };
            },
            { base64: (await readFile(outputPath!)).toString('base64'), controlProbePoint }
        );

        expect(exportCenter.center.lat).toBeCloseTo(originalCenter.lat, 3);
        expect(exportCenter.center.lng).toBeCloseTo(originalCenter.lng, 3);
        expect(restoredView.center.lat).toBeCloseTo(originalCenter.lat, 3);
        expect(restoredView.center.lng).toBeCloseTo(originalCenter.lng, 3);
        expect(restoredView.zoom).toBe(originalCenter.zoom);
        expect(restoredView.size.x).not.toBe(3200);
        expect(restoredView.size.y).not.toBe(1800);
        expect(expandedTileCount).toBeGreaterThan(0);
        expect(expandedTileCount).toBeLessThan(120);
        expect(tileUrlsBeforeRestore).toBeLessThan(120);
        expect(tileRequestUrls.size).toBeLessThan(120);
        expect(centerPixel.centerPixel[0]).toBeGreaterThan(centerPixel.centerPixel[1] + 80);
        expect(centerPixel.cornerPixel).not.toEqual([221, 221, 221, 255]);
        expect(centerPixel.controlPixel).not.toEqual([255, 0, 255, 255]);
        await expect(page.locator('#map')).not.toHaveAttribute('inert');
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
        const restoredCenter = await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const center = app.config.globalProperties.$pinia._s.get('map').map.getCenter();
            return { lat: center.lat, lng: center.lng };
        });
        expect(restoredCenter.lat).toBeCloseTo(originalCenter.lat, 3);
        expect(restoredCenter.lng).toBeCloseTo(originalCenter.lng, 3);
    });
});
