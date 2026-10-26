import { expect, test, type Locator, type Page } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { addFreshStorageInitScript, waitForFreshStorage } from './indexedDbHelpers';
import { clickMap, waitForMapReady } from './layers/layerMapTestHelpers';
import { setMapZoom } from './layers/layerPointTestHelpers';

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

async function setTileResponse(page: Page, tilePng: Buffer, status = 200) {
    await page.route('**/hot/**/*.png', async (route) => {
        await route.fulfill({
            status,
            contentType: status === 200 ? 'image/png' : 'text/html',
            headers: { 'access-control-allow-origin': '*' },
            body: status === 200 ? tilePng : 'Tile request failed'
        });
    });
}

async function selectDistantGroupPoints(page: Page): Promise<Locator> {
    await waitForMapReady(page);
    await setMapZoom(page, 15);
    await page.locator('#modal-filter-button').click();
    await page.evaluate(() => {
        const app = (document.getElementById('app') as any).__vue_app__;
        const map = app.config.globalProperties.$pinia._s.get('map').map;
        map.setView([51, -1], 15, { animate: false });
    });
    await clickMap(page);
    await page.evaluate(() => {
        const app = (document.getElementById('app') as any).__vue_app__;
        const map = app.config.globalProperties.$pinia._s.get('map').map;
        map.setView([55, 3], 15, { animate: false });
    });
    await clickMap(page);
    await page.locator('#modal-filter-button').click();

    await page.evaluate(() => {
        const app = (document.getElementById('app') as any).__vue_app__;
        const pinia = app.config.globalProperties.$pinia;
        const map = pinia._s.get('map').map;
        const elements = Array.from(
            document.querySelectorAll('.leaflet-filters-pane path.modal-filter-marker')
        );
        if (elements.length !== 2) {
            throw new Error('Expected two modal filter marker elements');
        }
        const features = new Map<Element, any>();
        const findFeature = (layer: any) => {
            const element = layer.getElement?.();
            if (elements.includes(element) && layer.getLatLng) {
                features.set(element, layer);
            }
            layer.eachLayer?.(findFeature);
        };
        map.eachLayer(findFeature);
        if (features.size !== elements.length) {
            throw new Error('Modal filter marker layers not found');
        }

        const groupFeatures = elements.map((element) => features.get(element));
        const selection = pinia._s.get('selection');
        selection.setSelected(
            groupFeatures.map((feature) => ({
                layerId: 'ModalFilters',
                historyId: null,
                latLng: feature.getLatLng(),
                marker: feature
            }))
        );
        selection.markGroupSelection('export-group');
        map.setView([0, 0], 12, { animate: false });
    });
    await setMapZoom(page, 12);

    const markers = page.locator('.leaflet-filters-pane path.modal-filter-marker');
    await expect(markers).toHaveCount(2);
    await expect
        .poll(() => markers.first().evaluate((element) => getComputedStyle(element).visibility))
        .toBe('hidden');
    await expect
        .poll(() => markers.last().evaluate((element) => getComputedStyle(element).visibility))
        .toBe('hidden');
    return markers;
}

test.describe('Image export from Share panel', () => {
    test('image shortcut leaves ordinary dialogs and dual-modifier events untouched', async ({
        page
    }) => {
        const downloads: string[] = [];
        page.on('download', (download) => downloads.push(download.suggestedFilename()));
        await page.locator('#settings-button').click();
        const close = page.getByRole('button', { name: 'Close settings panel' });
        await close.focus();
        await page.keyboard.press('Control+i');
        await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
        await close.click();
        await page.locator('#map').focus();
        await page.keyboard.press('Control+Meta+i');
        await page.waitForTimeout(500);
        expect(downloads).toEqual([]);
        await expect(page.locator('#sharing')).not.toBeAttached();
    });

    test('image shortcut works in Share unless an export error is displayed', async ({ page }) => {
        await page.locator('#share-button').click();
        await page.locator('#export-as-image').click();
        await page.locator('#width').fill('9000');
        await expect(page.locator('#image-export-error')).toBeVisible();
        const format = page.locator('#export-as-image');
        await format.focus();
        const downloads: string[] = [];
        page.on('download', (download) => downloads.push(download.suggestedFilename()));
        await page.keyboard.press('Control+i');
        await page.waitForTimeout(500);
        expect(downloads).toEqual([]);

        await page.locator('#width').fill('640');
        await expect(page.locator('#image-export-error')).not.toBeAttached();
        await format.focus();
        const download = page.waitForEvent('download');
        await page.keyboard.press('Control+i');
        await download;
        await expect(page.getByRole('dialog', { name: 'Share map' })).toBeVisible();
        await expect(format).toHaveAttribute('aria-pressed', 'true');
    });

    test('Ctrl+I downloads immediately at the current map dimensions without opening Share', async ({
        page
    }) => {
        await waitForMapReady(page);
        await page.locator('#map').focus();
        const expectedDimensions = await page
            .locator('#map')
            .evaluate((element) => [element.clientWidth, element.clientHeight]);
        const downloadPromise = page.waitForEvent('download');
        await page.keyboard.press('Control+i');
        await expect(page.locator('#sharing')).not.toBeAttached();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/\.png$/);
        const path = await download.path();
        expect(path).not.toBeNull();
        const dimensions = await page.evaluate(
            async (base64) => {
                const image = new Image();
                image.src = `data:image/png;base64,${base64}`;
                await image.decode();
                return [image.width, image.height];
            },
            (await readFile(path!)).toString('base64')
        );
        expect(dimensions).toEqual(expectedDimensions);
        await page.locator('#share-button').click();
        await expect(page.locator('#export-as-html')).toHaveAttribute('aria-pressed', 'true');
    });

    test('image shortcut preserves selected-group framing and restores the original view', async ({
        page
    }) => {
        await selectDistantGroupPoints(page);
        const original = await page.evaluate(() => {
            const pinia = (document.getElementById('app') as any).__vue_app__.config
                .globalProperties.$pinia;
            const map = pinia._s.get('map').map;
            const centre = map.getCenter();
            return { lat: centre.lat, lng: centre.lng, zoom: map.getZoom() };
        });
        await page.locator('#map').focus();
        const downloadPromise = page.waitForEvent('download');
        await page.keyboard.press('Control+i');
        await expect(page.locator('#sharing')).not.toBeAttached();
        await downloadPromise;
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const pinia = (document.getElementById('app') as any).__vue_app__.config
                        .globalProperties.$pinia;
                    const map = pinia._s.get('map').map;
                    const centre = map.getCenter();
                    return { lat: centre.lat, lng: centre.lng, zoom: map.getZoom() };
                })
            )
            .toEqual(original);
    });

    test('image shortcut respects typing and downloads directly in Presentation mode', async ({
        page
    }) => {
        await page.locator('#settings-button').click();
        await page.locator('#title').focus();
        await page.keyboard.press('Control+i');
        await expect(page.locator('#title')).toBeVisible();
        await expect(page.locator('#sharing')).not.toBeAttached();
        await page.getByRole('button', { name: 'Close settings panel' }).click();
        await page.locator('#map').focus();
        await page.keyboard.press('p');
        await expect(page.locator('#modal-filter-button')).not.toBeVisible();
        const downloadPromise = page.waitForEvent('download');
        await page.keyboard.press('Meta+i');
        await downloadPromise;
        await expect(page.locator('#sharing')).not.toBeAttached();
    });

    test('image shortcut reports active-tool errors without opening Share', async ({ page }) => {
        await waitForMapReady(page);
        await page.locator('#mobility-lane-button').click();
        await page.locator('#map').focus();
        await page.keyboard.press('Control+i');
        await expect(page.locator('#sharing')).not.toBeAttached();
        await expect(page.getByRole('dialog', { name: 'An error has occurred' })).toBeVisible();
        await expect(page.getByRole('dialog', { name: 'An error has occurred' })).toContainText(
            'Finish or cancel the active map tool'
        );
    });

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

    test('shows static legend entries after the interactive legend was collapsed', async ({
        page
    }) => {
        const interactiveLegend = page.locator('.legend');
        await interactiveLegend.getByRole('button', { name: 'Legend' }).click();
        await expect(interactiveLegend.locator('.legend-content')).toHaveClass(/hidden/);

        await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            app.config.globalProperties.$pinia._s
                .get('ui')
                .setImageExportState(true, new Set(['LtnCells']));
        });

        const exportLegend = page.locator('[data-image-export-legend]');
        await expect(exportLegend.locator('.legend-content')).toBeVisible();
        await expect(exportLegend.locator('li').first()).toBeVisible();

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

    test('fits a selected group to the export size and restores the original map view', async ({
        page
    }) => {
        await selectDistantGroupPoints(page);
        await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app.config.globalProperties.$pinia;
            const map = pinia._s.get('map').map;
            const groupFeatures = pinia._s.get('selection').selected;
            (window as any).__groupFitDuringExport = false;
            (window as any).__groupFeaturesVisibleDuringExport = new Set<Element>();
            map.on('moveend', () => {
                if (
                    pinia._s.get('ui').imageExportInProgress &&
                    groupFeatures.every((feature: any) => map.getBounds().contains(feature.latLng))
                ) {
                    (window as any).__groupFitDuringExport = true;
                }
            });
            for (const { marker } of groupFeatures) {
                const element = (marker as any).getElement() as Element;
                new MutationObserver(() => {
                    if (getComputedStyle(element).visibility === 'visible') {
                        (window as any).__groupFeaturesVisibleDuringExport.add(element);
                    }
                }).observe(element, { attributes: true, attributeFilter: ['style'] });
            }
        });
        const markers = page.locator('.leaflet-filters-pane path.modal-filter-marker');

        await page.locator('#share-button').click();
        await page.locator('#export-as-image').click();
        await expect(page.locator('#image-export-description')).toContainText(
            'The selected group is fitted to the PNG.'
        );
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export PNG' }).click();
        await downloadPromise;

        const exportState = await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const map = app.config.globalProperties.$pinia._s.get('map').map;
            return {
                groupFitDuringExport: (window as any).__groupFitDuringExport,
                groupFeaturesVisible: (window as any).__groupFeaturesVisibleDuringExport.size === 2,
                center: map.getCenter(),
                zoom: map.getZoom()
            };
        });
        expect(exportState.groupFitDuringExport).toBe(true);
        expect(exportState.groupFeaturesVisible).toBe(true);
        expect(exportState.center.lat).toBeCloseTo(0, 5);
        expect(exportState.center.lng).toBeCloseTo(0, 5);
        expect(exportState.zoom).toBe(12);
    });

    test('describes and exports an empty group selection at the current map scale', async ({
        page
    }) => {
        await waitForMapReady(page);
        const originalView = await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app.config.globalProperties.$pinia;
            const map = pinia._s.get('map').map;
            const selection = pinia._s.get('selection');
            selection.setSelected([]);
            selection.markGroupSelection('empty-export-group');
            map.setView([51, -1], 12, { animate: false });
            map.fitBounds = () => {
                throw new Error('An empty group must not be fitted.');
            };
            return { center: map.getCenter(), zoom: map.getZoom() };
        });

        await page.locator('#share-button').click();
        await page.locator('#export-as-image').click();
        await expect(page.locator('#image-export-description')).toContainText(
            'PNG at the current map scale.'
        );
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export PNG' }).click();
        await downloadPromise;
        await expect(page.locator('#map')).not.toHaveAttribute('aria-busy');
        const restoredView = await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const map = app.config.globalProperties.$pinia._s.get('map').map;
            return { center: map.getCenter(), zoom: map.getZoom() };
        });
        expect(restoredView.center.lat).toBeCloseTo(originalView.center.lat, 3);
        expect(restoredView.center.lng).toBeCloseTo(originalView.center.lng, 3);
        expect(restoredView.zoom).toBe(originalView.zoom);
    });

    for (const pointCount of [1, 2]) {
        test(`exports a group with ${pointCount} coincident point(s) and restores the view`, async ({
            page
        }) => {
            await selectDistantGroupPoints(page);
            await page.evaluate((pointCount) => {
                const app = (document.getElementById('app') as any).__vue_app__;
                const pinia = app.config.globalProperties.$pinia;
                const selection = pinia._s.get('selection');
                const entries = selection.selected.slice(0, pointCount);
                const latLng = entries[0].latLng;
                for (const entry of entries) {
                    entry.marker.setLatLng(latLng);
                }
                selection.setSelected(entries.map((entry: any) => ({ ...entry, latLng })));
                selection.markGroupSelection('coincident-export-group');
            }, pointCount);

            await page.locator('#share-button').click();
            await page.locator('#export-as-image').click();
            const downloadPromise = page.waitForEvent('download');
            await page.getByRole('button', { name: 'Export PNG' }).click();
            const download = await downloadPromise;
            const outputPath = await download.path();
            expect(outputPath).not.toBeNull();
            const image = await readFile(outputPath!);
            expect(image.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
            await expect(page.locator('#image-export-error')).not.toBeAttached();
            await expect(page.locator('#map')).not.toHaveAttribute('aria-busy');
            const restoredView = await page.evaluate(() => {
                const app = (document.getElementById('app') as any).__vue_app__;
                const map = app.config.globalProperties.$pinia._s.get('map').map;
                return { center: map.getCenter(), zoom: map.getZoom() };
            });
            expect(restoredView.center.lat).toBeCloseTo(0, 5);
            expect(restoredView.center.lng).toBeCloseTo(0, 5);
            expect(restoredView.zoom).toBe(12);
        });
    }

    test('reports a failed group fit and restores the view even after partial movement', async ({
        page
    }) => {
        const markers = await selectDistantGroupPoints(page);
        const map = page.locator('#map');
        const originalStyle = await map.getAttribute('style');
        await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const map = app.config.globalProperties.$pinia._s.get('map').map;
            const originalFitBounds = map.fitBounds;
            map.fitBounds = () => {
                map.fitBounds = originalFitBounds;
                map.setView([54, 2], 14, { animate: false });
                throw new Error('Group fit failed after moving the map.');
            };
        });

        await page.locator('#share-button').click();
        await page.locator('#export-as-image').click();
        const downloadPromise = page.waitForEvent('download', { timeout: 1000 }).catch(() => null);
        await page.getByRole('button', { name: 'Export PNG' }).click();
        await expect(page.locator('#image-export-error')).toHaveText(
            'Group fit failed after moving the map.'
        );
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
            .toEqual(['hidden', 'hidden']);
        const restoredView = await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const map = app.config.globalProperties.$pinia._s.get('map').map;
            return { center: map.getCenter(), zoom: map.getZoom() };
        });
        expect(restoredView.center.lat).toBeCloseTo(0, 5);
        expect(restoredView.center.lng).toBeCloseTo(0, 5);
        expect(restoredView.zoom).toBe(12);

        const retryDownload = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export PNG' }).click();
        await retryDownload;
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
