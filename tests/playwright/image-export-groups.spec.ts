import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { addFreshStorageInitScript, waitForFreshStorage } from './indexedDbHelpers';
import { waitForMapReady } from './layers/layerMapTestHelpers';
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
});
