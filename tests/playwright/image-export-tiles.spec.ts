import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { addFreshStorageInitScript, waitForFreshStorage } from './indexedDbHelpers';
import { createTilePng, setTileResponse } from './imageExportTestHelpers';

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
});
