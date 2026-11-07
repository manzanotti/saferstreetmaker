import { expect, test } from '@playwright/test';
import {
    addFirstNavigationStorageResetScript,
    getLayerFeatures,
    waitForFreshStorage
} from '../indexedDbHelpers';
import { createGroup, dragSelectCenter, openGroupsPanel } from '../groups/groupTestHelpers';
import {
    drawPolygon,
    drawPolygonClosingAtFirstVertex,
    getLayerFeatureCount,
    waitForHistoryButtons,
    waitForMapReady
} from './layerMapTestHelpers';
import { clickSvgPath, dragFirstEditHandle } from './layerSvgTestHelpers';

test.describe('Layer: Junction Narrowing', () => {
    test.beforeEach(async ({ page, context }) => {
        await context.grantPermissions(['geolocation']);
        await context.setGeolocation({ latitude: 52.5, longitude: -1.9 });
        await addFirstNavigationStorageResetScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        await waitForMapReady(page);
    });

    test('draws a solid black polygon, saves its name, and restores it after reload', async ({
        page
    }) => {
        const button = page.locator('#junction-narrowing-button');
        await expect(button).toBeVisible();
        await expect
            .poll(() =>
                button.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)
            )
            .toBeGreaterThan(0);
        await button.click();
        await expect(button).toHaveAttribute('aria-pressed', 'true');
        await drawPolygon(page);

        const polygon = page.locator('.leaflet-overlay-pane path.junction-narrowing');
        await expect(polygon).toHaveCount(1);
        await expect(polygon).toHaveAttribute('fill', '#000000');
        await expect(polygon).toHaveAttribute('fill-opacity', '1');
        await expect(polygon).toHaveAttribute('stroke', '#000000');
        await expect(page.locator('#JunctionNarrowings-legend')).toBeVisible();

        const name = page.locator('.leaflet-popup .name-editor');
        await name.fill('High Street junction');
        await name.press('Tab');
        await expect
            .poll(() => getLayerFeatures(page, 'Hello Cleveland', 'JunctionNarrowings'))
            .toMatchObject([
                {
                    geometry: { type: 'Polygon' },
                    properties: { name: 'High Street junction', historyId: expect.any(String) }
                }
            ]);
        await expect.poll(() => getLayerFeatureCount(page, 'LtnCells')).toBe(0);

        await page.reload();
        await waitForMapReady(page);
        await expect(polygon).toHaveCount(1);
        await expect(polygon).toHaveAttribute('fill', '#000000');
        await expect
            .poll(() => getLayerFeatures(page, 'Hello Cleveland', 'JunctionNarrowings'))
            .toMatchObject([{ properties: { name: 'High Street junction' } }]);
    });

    test('supports editing, undo, redo, and deleting a polygon', async ({ page }) => {
        await page.locator('#junction-narrowing-button').click();
        await drawPolygon(page);
        await page
            .locator('.leaflet-popup.feature-popup-editor .leaflet-popup-close-button')
            .click();
        await expect(page.locator('.leaflet-popup.feature-popup-editor')).toHaveCount(0);
        await page.locator('#junction-narrowing-button').click();

        const polygon = page.locator('.leaflet-overlay-pane path.junction-narrowing');
        const before = await getLayerFeatures(page, 'Hello Cleveland', 'JunctionNarrowings');
        await clickSvgPath(page, polygon);
        await expect(page.locator('.leaflet-editing-icon').first()).toBeVisible();
        await dragFirstEditHandle(page, 25, 20);
        await expect
            .poll(() => getLayerFeatures(page, 'Hello Cleveland', 'JunctionNarrowings'))
            .not.toEqual(before);
        const after = await getLayerFeatures(page, 'Hello Cleveland', 'JunctionNarrowings');

        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });
        await page.locator('#undo-button').click();
        await expect
            .poll(() => getLayerFeatures(page, 'Hello Cleveland', 'JunctionNarrowings'))
            .toEqual(before);
        await page.locator('#redo-button').click();
        await expect
            .poll(() => getLayerFeatures(page, 'Hello Cleveland', 'JunctionNarrowings'))
            .toEqual(after);

        await clickSvgPath(page, polygon);
        await page.getByRole('button', { name: 'Delete selected feature' }).click();
        await expect.poll(() => getLayerFeatureCount(page, 'JunctionNarrowings')).toBe(0);
        await page.locator('#undo-button').click();
        await expect.poll(() => getLayerFeatureCount(page, 'JunctionNarrowings')).toBe(1);
    });

    test('finishes at the first vertex and remains ready to draw another polygon', async ({
        page
    }) => {
        const button = page.locator('#junction-narrowing-button');
        await button.click();
        await drawPolygonClosingAtFirstVertex(page);
        await expect.poll(() => getLayerFeatureCount(page, 'JunctionNarrowings')).toBe(1);
        await expect(button).toHaveAttribute('aria-pressed', 'true');

        await page
            .locator('.leaflet-popup.feature-popup-editor .leaflet-popup-close-button')
            .click();
        await expect(page.locator('.leaflet-popup.feature-popup-editor')).toHaveCount(0);
        await drawPolygonClosingAtFirstVertex(page);
        await expect.poll(() => getLayerFeatureCount(page, 'JunctionNarrowings')).toBe(2);
        await expect(button).toHaveAttribute('aria-pressed', 'true');

        await page.locator('#undo-button').click();
        await expect.poll(() => getLayerFeatureCount(page, 'JunctionNarrowings')).toBe(1);
        await page.locator('#redo-button').click();
        await expect.poll(() => getLayerFeatureCount(page, 'JunctionNarrowings')).toBe(2);
    });

    test('copies and pastes a polygon with a distinct identity', async ({ page }) => {
        await page.locator('#junction-narrowing-button').click();
        await drawPolygon(page);
        const name = page.locator('.leaflet-popup .name-editor');
        await name.fill('Corner narrowing');
        await name.press('Tab');
        await page
            .locator('.leaflet-popup.feature-popup-editor .leaflet-popup-close-button')
            .click();
        await expect(page.locator('.leaflet-popup.feature-popup-editor')).toHaveCount(0);
        await page.locator('#junction-narrowing-button').click();

        await clickSvgPath(page, page.locator('.leaflet-overlay-pane path.junction-narrowing'));
        await page.getByRole('button', { name: 'Copy selected feature' }).click();
        await page.getByRole('button', { name: 'Paste copied features' }).click();
        await expect.poll(() => getLayerFeatureCount(page, 'JunctionNarrowings')).toBe(2);

        const features = await getLayerFeatures(page, 'Hello Cleveland', 'JunctionNarrowings');
        expect(features.map((feature) => feature.properties?.name)).toEqual([
            'Corner narrowing',
            'Corner narrowing'
        ]);
        expect(new Set(features.map((feature) => feature.properties?.historyId)).size).toBe(2);
        await page.locator('#undo-button').click();
        await expect.poll(() => getLayerFeatureCount(page, 'JunctionNarrowings')).toBe(1);
    });

    test('renders named polygons in shared read-only maps', async ({ page }) => {
        await page.locator('#junction-narrowing-button').click();
        await drawPolygon(page);
        const name = page.locator('.leaflet-popup .name-editor');
        await name.fill('Shared junction');
        await name.press('Tab');
        await expect
            .poll(() => getLayerFeatures(page, 'Hello Cleveland', 'JunctionNarrowings'))
            .toMatchObject([{ properties: { name: 'Shared junction' } }]);

        await page.locator('#settings-button').click();
        await page.locator('#read-only').check();
        await page.getByRole('button', { name: 'Save' }).click();
        await expect(page.locator('#junction-narrowing-button')).not.toBeAttached();
        await page.evaluate(() => {
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: {
                    writeText: async (text: string) => {
                        (window as Window & { junctionShareUrl?: string }).junctionShareUrl = text;
                    }
                }
            });
        });
        await page.locator('#share-button').click();
        await page.locator('#export-as-url').click();
        await page.getByRole('button', { name: 'Create' }).click();
        await expect(page.locator('#messageRow')).toBeVisible();
        const shareUrl = await page.evaluate(
            () => (window as Window & { junctionShareUrl?: string }).junctionShareUrl
        );
        expect(shareUrl).toBeTruthy();
        if (!shareUrl) {
            throw new Error('Expected a shared map URL');
        }

        await page.goto(shareUrl);
        await page.addStyleTag({ content: '#help { display: none !important; }' });
        const polygon = page.locator('.leaflet-overlay-pane path.junction-narrowing');
        await expect(polygon).toHaveCount(1);
        await expect(polygon).toHaveAttribute('fill', '#000000');
        await expect(page.locator('#junction-narrowing-button')).not.toBeAttached();
        await clickSvgPath(page, polygon);
        await expect(page.locator('.feature-popup-description')).toContainText('Shared junction');
        await expect(page.locator('.leaflet-editing-icon')).toHaveCount(0);
    });

    test('supports group selection, visibility, and layer visibility', async ({ page }) => {
        await page.locator('#junction-narrowing-button').click();
        await drawPolygon(page);
        await page
            .locator('.leaflet-popup.feature-popup-editor .leaflet-popup-close-button')
            .click();
        await expect(page.locator('.leaflet-popup.feature-popup-editor')).toHaveCount(0);
        await page.locator('#junction-narrowing-button').click();
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 90);
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await createGroup(page, 'Safer junction');
        await openGroupsPanel(page);

        const polygon = page.locator('.leaflet-overlay-pane path.junction-narrowing');
        await page.getByRole('button', { name: 'Hide group Safer junction' }).click();
        await expect(polygon).toHaveAttribute('fill-opacity', '0');
        await page.getByRole('button', { name: 'Show only group Safer junction' }).click();
        await expect(polygon).toHaveAttribute('fill-opacity', '1');
        await page.getByRole('button', { name: 'Close groups panel' }).click();

        await page.locator('#JunctionNarrowings-legend').click();
        await expect(polygon).toHaveCount(0);
        await page.locator('#JunctionNarrowings-legend').click();
        await expect(polygon).toHaveCount(1);
    });
});
