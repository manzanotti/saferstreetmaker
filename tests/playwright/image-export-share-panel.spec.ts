import { expect, test } from '@playwright/test';
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
});
