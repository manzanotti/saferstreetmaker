import { test, expect, type Locator, type Page } from '@playwright/test';
import type { App } from 'vue';
import type { useMapStore } from '../../src/stores/mapStore';
import {
    setupPage,
    placeModalFilter,
    drawNamedMobilityLane,
    drawNamedLtnCell
} from './groups/groupTestHelpers';

async function resizeMapViewport(page: Page, width: number, height: number) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction((expectedWidth) => {
        const root = document.getElementById('app') as HTMLElement & { __vue_app__: App };
        const mapStore = root.__vue_app__.config.globalProperties.$pinia._s.get(
            'map'
        ) as ReturnType<typeof useMapStore>;
        return mapStore.map?.getSize().x === expectedWidth;
    }, width);
}

async function dragEditor(page: Page, popup: Locator, dx = 60, dy = 25) {
    const before = await popup.boundingBox();
    const heading = await popup.locator('.feature-popup-groups > strong').boundingBox();
    const mapStyle = await page.locator('.leaflet-map-pane').getAttribute('style');
    await page.mouse.move(heading!.x + 10, heading!.y + 5);
    await page.mouse.down();
    await expect(popup).toHaveCSS('cursor', 'move');
    await page.mouse.move(heading!.x + 10 + dx, heading!.y + 5 + dy, { steps: 10 });
    await page.mouse.up();
    const after = await popup.boundingBox();
    expect(after!.x - before!.x).toBeCloseTo(dx, 0);
    expect(after!.y - before!.y).toBeCloseTo(dy, 0);
    expect(await page.locator('.leaflet-map-pane').getAttribute('style')).toBe(mapStyle);
}

test.beforeEach(async ({ page, context }) => {
    await setupPage(page, context);
});

test('marker action editor moves with its close button and retains group controls', async ({
    page
}) => {
    await placeModalFilter(page);
    await page.locator('#modal-filter-button').click();
    const marker = page.locator('.leaflet-filters-pane path.modal-filter-marker').first();
    await marker.dispatchEvent('click');
    const popup = page.locator('.leaflet-popup.movable-editor-popup');
    const close = popup.getByRole('button', { name: 'Close popup' });
    const closeBefore = await close.boundingBox();
    await dragEditor(page, popup);
    const closeAfter = await close.boundingBox();
    expect(closeAfter!.x - closeBefore!.x).toBeCloseTo(60, 0);
    expect(closeAfter!.y - closeBefore!.y).toBeCloseTo(25, 0);
    const offset = await popup.evaluate((element) => element.style.translate);
    await popup.locator('.add-feature-to-group-select').selectOption('__create-new-group__');
    await page.getByLabel('Group name').fill('Moved editor group');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(popup.locator('.feature-popup-groups')).toContainText('Moved editor group');
    expect(await popup.evaluate((element) => element.style.translate)).toBe(offset);
    await close.click();
    await expect(popup).not.toBeVisible();
});

test('line editor stays editable after dragging and resets on reopening', async ({ page }) => {
    await drawNamedMobilityLane(page, '');
    const line = page.locator('path.mobility-lane.leaflet-interactive').first();
    const lineBox = await line.boundingBox();
    const clickPosition = {
        clientX: lineBox!.x + lineBox!.width / 2,
        clientY: lineBox!.y + lineBox!.height / 2
    };
    await line.dispatchEvent('click', clickPosition);
    const popup = page.locator('.leaflet-popup.movable-editor-popup');
    await dragEditor(page, popup);
    const offset = await popup.evaluate((element) => element.style.translate);
    await popup.locator('.name-editor').fill('Moved mobility lane');
    await popup.locator('.name-editor').press('Enter');
    expect(await popup.evaluate((element) => element.style.translate)).toBe(offset);
    await popup.getByRole('button', { name: 'Close popup' }).click();
    await expect(popup).not.toBeVisible();
    await line.dispatchEvent('click', clickPosition);
    await expect(popup.locator('.name-editor')).toHaveValue('Moved mobility lane');
    expect(await popup.evaluate((element) => element.style.translate)).toBe('');
});

test('LTN cell label and colour remain editable without moving its geometry', async ({ page }) => {
    await drawNamedLtnCell(page, 'Original cell');
    const cell = page.locator('path.ltn-cell.leaflet-interactive').first();
    await cell.dispatchEvent('click');
    const popup = page.locator('.leaflet-popup.movable-editor-popup');
    const geometry = await cell.getAttribute('d');
    await dragEditor(page, popup);
    await popup.getByLabel('LTN cell label').fill('Moved cell editor');
    await popup.getByLabel('Change cell colour').fill('#0088aa');
    await expect(cell).toHaveAttribute('stroke', '#0088aa');
    expect(await cell.getAttribute('d')).toBe(geometry);
    await popup.getByLabel('LTN cell label').press('Enter');
    await expect(popup).not.toBeVisible();
    await cell.dispatchEvent('click');
    await expect(popup.getByLabel('LTN cell label')).toHaveValue('Moved cell editor');
    await expect(popup.getByLabel('Change cell colour')).toHaveValue('#0088aa');
    expect(await popup.evaluate((element) => element.style.translate)).toBe('');
});

test('copy still works from a moved marker editor', async ({ page }) => {
    await placeModalFilter(page);
    await page.locator('#modal-filter-button').click();
    await page.locator('path.modal-filter-marker').first().dispatchEvent('click');
    const popup = page.locator('.leaflet-popup.movable-editor-popup');
    await dragEditor(page, popup);
    await popup.getByRole('button', { name: 'Copy selected feature' }).click();
    await expect(popup).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Paste copied features' })).toBeVisible();
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

test('touch long-press moves the editor and a second finger on the map cancels dragging', async ({
    page,
    context
}) => {
    await placeModalFilter(page);
    await page.locator('#modal-filter-button').click();
    await page.locator('path.modal-filter-marker').first().dispatchEvent('click');
    const popup = page.locator('.leaflet-popup.movable-editor-popup');
    const session = await context.newCDPSession(page);
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    const heading = await popup.locator('.feature-popup-groups > strong').boundingBox();
    const first = { id: 0, x: heading!.x + 10, y: heading!.y + 5 };
    const before = await popup.boundingBox();
    await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [first]
    });
    await expect(popup).toHaveClass(/panel-moving/);
    const movedTouch = { ...first, x: first.x + 45, y: first.y + 15 };
    await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [movedTouch]
    });
    const moved = await popup.boundingBox();
    expect(moved!.x - before!.x).toBeCloseTo(45, 0);
    expect(moved!.y - before!.y).toBeCloseTo(15, 0);
    await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [movedTouch, { id: 1, x: 1000, y: 650 }]
    });
    await expect(popup).not.toHaveClass(/panel-moving/);
    await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
            { ...movedTouch, x: movedTouch.x + 20 },
            { id: 1, x: 980, y: 650 }
        ]
    });
    expect(await popup.evaluate((element) => element.style.translate)).toBe('45px 15px');
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('html')).not.toHaveClass(/panel-dragging/);
});
