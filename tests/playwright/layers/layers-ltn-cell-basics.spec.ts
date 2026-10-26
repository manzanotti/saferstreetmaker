import { test, expect } from '@playwright/test';
import { setupFreshPage } from './layerTestSetup';
import {
    getLayerFeatureCount,
    clickMap,
    waitForHistoryButtons,
    drawPolyline,
    drawPolygon,
    drawPolygonClosingAtFirstVertex,
    deleteFirstShape
} from './layerMapTestHelpers';
import { clickSvgPath, hoverSvgPathStroke } from './layerSvgTestHelpers';
import { hoverLocatorCenter } from './layerHoverTestHelpers';
import {
    getInlineCursor,
    getCursorAtLocatorCenter,
    getCursorAtPagePoint,
    moveToMapOffset
} from './layerCursorTestHelpers';

test.describe('Layer: LTN Cell (polygon): basics', () => {
    setupFreshPage();

    test('can draw the next LTN across an existing cell after placing its first vertex', async ({
        page
    }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        await page.locator('.label-editor').press('Enter');
        await expect(page.locator('.leaflet-popup.feature-popup-editor')).toHaveCount(0);
        const box = await page.locator('#map').boundingBox();
        if (!box) {
            throw new Error('Map bounding box not found');
        }
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        for (const [dx, dy] of [
            [130, -20],
            [0, 0],
            [130, 80],
            [130, -20]
        ]) {
            await page.mouse.click(cx + dx, cy + dy);
            await page.waitForTimeout(200);
        }
        await expect(page.locator('.label-editor')).toBeFocused();
        await expect.poll(() => getLayerFeatureCount(page, 'LtnCells')).toBe(2);
        await expect(page.locator('#ltn-button')).toHaveAttribute('aria-pressed', 'true');
        await page.locator('#modal-filter-button').click();
        await expect(page.locator('.leaflet-mouse-marker')).toHaveCount(0);
        await expect(page.locator('.leaflet-popup.feature-popup-editor')).toHaveCount(0);
    });

    for (const dismissal of ['Enter', 'close'] as const) {
        test(`draws consecutive LTN cells without toggling the tool after naming popup ${dismissal}`, async ({
            page
        }) => {
            const button = page.locator('#ltn-button');
            await button.click();
            const box = await page.locator('#map').boundingBox();
            if (!box) {
                throw new Error('Map bounding box not found');
            }
            const cy = box.y + box.height / 2;
            for (const [index, offset] of [-150, 150].entries()) {
                const cx = box.x + box.width / 2 + offset;
                await page.mouse.click(cx - 40, cy - 35);
                await page.waitForTimeout(200);
                await page.mouse.click(cx + 40, cy - 35);
                await page.waitForTimeout(200);
                await page.mouse.click(cx, cy + 35);
                await page.waitForTimeout(200);
                await page.mouse.click(cx - 40, cy - 35);

                const label = page.locator('.label-editor');
                await expect(label).toBeFocused();
                await label.fill(`Cell ${index + 1}`);
                if (dismissal === 'Enter') {
                    await label.press('Enter');
                } else {
                    await page.locator('.leaflet-popup-close-button').click();
                }
                await expect(page.locator('.leaflet-popup.feature-popup-editor')).toHaveCount(0);
                await expect(button).toHaveAttribute('aria-pressed', 'true');
                await expect(page.locator('.leaflet-mouse-marker')).toHaveCount(1);
                await expect.poll(() => getLayerFeatureCount(page, 'LtnCells')).toBe(index + 1);
            }

            await page.keyboard.press('Escape');
            await expect(button).toHaveAttribute('aria-pressed', 'false');
            await expect(page.locator('.leaflet-mouse-marker')).toHaveCount(0);
            await expect(page.locator('.leaflet-ltns-pane path.ltn-cell')).toHaveCount(2);
        });
    }

    test('toolbar button activates the layer', async ({ page }) => {
        await page.locator('#ltn-button').click();
        await expect(page.locator('#ltn-button')).toHaveAttribute('aria-pressed', 'true');
    });

    test('drawing a polygon creates an LTN cell and persists it', async ({ page }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        const count = await getLayerFeatureCount(page, 'LtnCells');
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test('completing a polygon opens the LTN popup with the title input focused', async ({
        page
    }) => {
        await page.locator('#ltn-button').click();
        await drawPolygonClosingAtFirstVertex(page);

        // The naming popup appears immediately, focused so the user can type a
        // title straight away.
        await expect(page.locator('.label-editor')).toBeVisible();
        await expect(page.locator('.label-editor')).toBeFocused();
    });

    test('deleting a drawn LTN cell removes it from storage', async ({ page }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBeGreaterThanOrEqual(1);

        await deleteFirstShape(page);

        expect(await getLayerFeatureCount(page, 'LtnCells')).toBe(0);
    });

    test('deactivating the button removes selected state', async ({ page }) => {
        const btn = page.locator('#ltn-button');
        await btn.click();
        await btn.click();
        await expect(btn).toHaveAttribute('aria-pressed', 'false');
    });
});
