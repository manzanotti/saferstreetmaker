import { test, expect } from '@playwright/test';
import {
    setupPage,
    placeModalFilter,
    drawNamedMobilityLane,
    drawNamedLtnCell
} from './groups/groupTestHelpers';
import { dragEditor } from './movableEditorTestHelpers';

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
