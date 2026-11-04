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

    test('image shortcut leaves ordinary dialogs and dual-modifier events untouched', async ({
        page
    }) => {
        const downloads: string[] = [];
        page.on('download', (download) => downloads.push(download.suggestedFilename()));
        await page.locator('#settings-button').click();
        const close = page.getByRole('button', { name: 'Close settings panel' });
        await close.focus();
        await page.keyboard.press('Control+Shift+i');
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
        await page.keyboard.press('Control+Shift+i');
        await page.waitForTimeout(500);
        expect(downloads).toEqual([]);

        await page.locator('#width').fill('640');
        await expect(page.locator('#image-export-error')).not.toBeAttached();
        await format.focus();
        const download = page.waitForEvent('download');
        await page.keyboard.press('Control+Shift+i');
        await download;
        await expect(page.getByRole('dialog', { name: 'Share map' })).toBeVisible();
        await expect(format).toHaveAttribute('aria-pressed', 'true');
    });

    test('Ctrl+Shift+I downloads immediately at the current map dimensions without opening Share', async ({
        page
    }) => {
        await waitForMapReady(page);
        await page.locator('#map').focus();
        const expectedDimensions = await page
            .locator('#map')
            .evaluate((element) => [element.clientWidth, element.clientHeight]);
        const downloadPromise = page.waitForEvent('download');
        await page.keyboard.press('Control+Shift+i');
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
        await page.keyboard.press('Control+Shift+i');
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
        await page.keyboard.press('Control+Shift+i');
        await expect(page.locator('#title')).toBeVisible();
        await expect(page.locator('#sharing')).not.toBeAttached();
        await page.getByRole('button', { name: 'Close settings panel' }).click();
        await page.locator('#map').focus();
        await page.keyboard.press('p');
        await expect(page.locator('#modal-filter-button')).not.toBeVisible();
        const downloadPromise = page.waitForEvent('download');
        await page.keyboard.press('Meta+Shift+i');
        await downloadPromise;
        await expect(page.locator('#sharing')).not.toBeAttached();
    });

    test('image shortcut reports active-tool errors without opening Share', async ({ page }) => {
        await waitForMapReady(page);
        await page.locator('#mobility-lane-button').click();
        await page.locator('#map').focus();
        await page.keyboard.press('Control+Shift+i');
        await expect(page.locator('#sharing')).not.toBeAttached();
        await expect(page.getByRole('dialog', { name: 'An error has occurred' })).toBeVisible();
        await expect(page.getByRole('dialog', { name: 'An error has occurred' })).toContainText(
            'Finish or cancel the active map tool'
        );
    });
});
