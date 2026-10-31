import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { addFreshStorageInitScript, waitForFreshStorage } from './indexedDbHelpers';
import { waitForMapReady } from './layers/layerMapTestHelpers';
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

    for (const zoomInProgress of [false, true]) {
        test(`keeps SVG and HTML features aligned with ${zoomInProgress ? 'an active' : 'a settled'} zoom`, async ({
            page
        }) => {
            await waitForMapReady(page);
            const expected = await page.evaluate(
                (targetZoom) => {
                    const app = (document.getElementById('app') as any).__vue_app__;
                    const map = app.config.globalProperties.$pinia._s.get('map').map;
                    const L = (window as any).L;
                    map.setView([52.5, -1.9], 15, { animate: false });
                    const positions = [
                        L.point(250, 200),
                        L.point(500, 250),
                        L.point(350, 450),
                        L.point(650, 400)
                    ].map((point) => map.containerPointToLatLng(point));
                    L.circleMarker(positions[0], {
                        radius: 12,
                        stroke: false,
                        fillColor: '#ff0000',
                        fillOpacity: 1,
                        pane: 'filters',
                        className: 'modal-filter-marker'
                    }).addTo(map);
                    const atOffset = (centre: any, x: number, y: number) =>
                        map.unproject(map.project(centre, 15).add([x, y]), 15);
                    L.polyline([atOffset(positions[1], -30, 0), atOffset(positions[1], 30, 0)], {
                        color: '#0000ff',
                        weight: 12,
                        opacity: 1
                    }).addTo(map);
                    L.polygon(
                        [
                            atOffset(positions[2], -15, -15),
                            atOffset(positions[2], 15, -15),
                            atOffset(positions[2], 15, 15),
                            atOffset(positions[2], -15, 15)
                        ],
                        { stroke: false, fillColor: '#00ff00', fillOpacity: 1 }
                    ).addTo(map);
                    L.marker(positions[3], {
                        icon: L.divIcon({
                            className: 'export-position-marker',
                            html: '<div style="width:20px;height:20px;background:#ff00ff"></div>',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })
                    }).addTo(map);
                    map.setZoom(16, { animate: false });
                    map.panBy([73, -41], { animate: false });
                    map.setZoom(15, { animate: false });
                    map.panBy([-31, 27], { animate: false });
                    map.panBy([180, 120], { animate: false });
                    const centre = map.project(map.getCenter(), targetZoom);
                    return positions.map((position: any) => {
                        const point = map.project(position, targetZoom).subtract(centre);
                        return { x: Math.round(point.x + 800), y: Math.round(point.y + 500) };
                    });
                },
                zoomInProgress ? 14 : 15
            );
            await page.locator('#share-button').click();
            await page.locator('#export-as-image').click();
            await page.locator('#width').fill('1600');
            await page.locator('#height').fill('1000');
            if (zoomInProgress) {
                await page.getByRole('button', { name: 'Export PNG' }).evaluate((button) => {
                    button.addEventListener(
                        'click',
                        () => {
                            const app = (document.getElementById('app') as any).__vue_app__;
                            app.config.globalProperties.$pinia._s
                                .get('map')
                                .map.setZoom(14, { animate: true });
                        },
                        { capture: true, once: true }
                    );
                });
            }
            const downloadPromise = page.waitForEvent('download');
            await page.getByRole('button', { name: 'Export PNG' }).click();
            const download = await downloadPromise;
            const path = await download.path();
            expect(path).not.toBeNull();
            const actual = await page.evaluate(
                async (base64) => {
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
                    return [
                        [255, 0, 0],
                        [0, 0, 255],
                        [0, 255, 0],
                        [255, 0, 255]
                    ].map((color) => {
                        let xSum = 0;
                        let ySum = 0;
                        let count = 0;
                        for (let y = 0; y < canvas.height; y++) {
                            for (let x = 0; x < canvas.width; x++) {
                                const index = (y * canvas.width + x) * 4;
                                if (
                                    color.every(
                                        (value, channel) => pixels[index + channel] === value
                                    )
                                ) {
                                    xSum += x;
                                    ySum += y;
                                    count++;
                                }
                            }
                        }
                        return { x: xSum / count, y: ySum / count, count };
                    });
                },
                (await readFile(path!)).toString('base64')
            );
            for (let index = 0; index < expected.length; index++) {
                expect(actual[index].count, `feature ${index} is rendered`).toBeGreaterThan(50);
                expect(
                    Math.abs(actual[index].x - expected[index].x),
                    `feature ${index} x`
                ).toBeLessThanOrEqual(2);
                expect(
                    Math.abs(actual[index].y - expected[index].y),
                    `feature ${index} y`
                ).toBeLessThanOrEqual(2);
            }
            const restoredZoom = await page.evaluate(() => {
                const app = (document.getElementById('app') as any).__vue_app__;
                return app.config.globalProperties.$pinia._s.get('map').map.getZoom();
            });
            expect(restoredZoom).toBe(zoomInProgress ? 14 : 15);
        });
    }
});
