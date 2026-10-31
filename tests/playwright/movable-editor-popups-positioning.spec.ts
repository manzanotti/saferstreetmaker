import { test, expect } from '@playwright/test';
import { setupPage, placeModalFilter } from './groups/groupTestHelpers';
import { resizeMapViewport, dragEditor } from './movableEditorTestHelpers';

test.beforeEach(async ({ page, context }) => {
    await setupPage(page, context);
});

test('drag offsets survive map positioning changes during zoom', async ({ page }) => {
    await placeModalFilter(page, 100);
    await page.locator('#modal-filter-button').click();
    await page.locator('path.modal-filter-marker').first().dispatchEvent('click');
    const popup = page.locator('.leaflet-popup.movable-editor-popup');
    await dragEditor(page, popup, 40, 15);
    const before = await popup.evaluate((element) => ({
        offset: element.style.translate,
        anchor: element.style.transform
    }));
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(page.locator('#map')).toHaveClass(/zoom-18/);
    const after = await popup.evaluate((element) => ({
        offset: element.style.translate,
        anchor: element.style.transform
    }));
    expect(after.offset).toBe(before.offset);
    expect(after.anchor).not.toBe(before.anchor);
});

for (const movement of ['pan', 'zoom']) {
    test(`a moved editor stays in view after map ${movement}`, async ({ page }) => {
        await page.getByRole('button', { name: 'Legend', exact: true }).click();
        await placeModalFilter(page, 100);
        await page.locator('#modal-filter-button').click();
        await page.locator('path.modal-filter-marker').first().dispatchEvent('click');
        const popup = page.locator('.leaflet-popup.movable-editor-popup');
        const box = await popup.boundingBox();
        await dragEditor(page, popup, page.viewportSize()!.width - box!.x - box!.width - 1, 0);
        const offset = await popup.evaluate((element) => element.style.translate);
        if (movement === 'pan') {
            await page.locator('#map').focus();
            await page.keyboard.press('ArrowLeft');
        } else {
            await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
            await expect(page.locator('#map')).toHaveClass(/zoom-18/);
        }
        await expect
            .poll(async () => {
                const rect = await popup.boundingBox();
                return rect!.x + rect!.width;
            })
            .toBeLessThanOrEqual(page.viewportSize()!.width + 1);
        await expect
            .poll(() => popup.evaluate((element) => element.style.translate))
            .not.toBe(offset);
        await popup.getByRole('button', { name: 'Close popup' }).click();
        await expect(popup).not.toBeVisible();
    });
}

test('resizing leaves an untouched editor anchored without adding a drag offset', async ({
    page
}) => {
    await placeModalFilter(page, 100);
    await page.locator('#modal-filter-button').click();
    await page.locator('path.modal-filter-marker').first().dispatchEvent('click');
    const popup = page.locator('.leaflet-popup.movable-editor-popup');
    expect(await popup.evaluate((element) => element.style.translate)).toBe('');
    await resizeMapViewport(page, 640, 600);
    expect(await popup.evaluate((element) => element.style.translate)).toBe('');
});

test('editor pop-ups stay reachable after dragging to an edge and resizing', async ({ page }) => {
    await placeModalFilter(page);
    await page.locator('#modal-filter-button').click();
    await page.locator('path.modal-filter-marker').first().dispatchEvent('click');
    const popup = page.locator('.leaflet-popup.movable-editor-popup');
    const heading = await popup.locator('.feature-popup-groups > strong').boundingBox();
    await page.mouse.move(heading!.x + 10, heading!.y + 5);
    await page.mouse.down();
    await page.mouse.move(1200, 680, { steps: 10 });
    await page.mouse.up();
    await resizeMapViewport(page, 640, 600);
    await expect
        .poll(async () => {
            const box = await popup.boundingBox();
            return box!.x + box!.width;
        })
        .toBeLessThanOrEqual(641);
    const box = await popup.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(601);
    await popup.getByRole('button', { name: 'Close popup' }).click();
    await expect(popup).not.toBeVisible();
});
