import { test, expect, type Locator, type Page } from '@playwright/test';
import { addFreshStorageInitScript, waitForFreshStorage } from './indexedDbHelpers';

async function drag(page: Page, heading: Locator, dx: number, dy: number) {
    const box = await heading.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + 8, box!.y + box!.height / 2);
    await page.mouse.down();
    await expect(heading).toHaveCSS('cursor', 'move');
    await page.mouse.move(box!.x + 8 + dx, box!.y + box!.height / 2 + dy, { steps: 10 });
    await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
    await addFreshStorageInitScript(page);
    await page.goto('/');
    await waitForFreshStorage(page);
    await expect(page.locator('#settings-button')).toBeVisible();
});

for (const [button, title] of [
    ['settings-button', 'settings-panel-title'],
    ['map-manager-button', 'map-manager-panel-title'],
    ['share-button', 'sharing-panel-title'],
    ['help-button', 'help-panel-title'],
    ['groups-button', 'groups-panel-title'],
    ['layers-button', 'layers-panel-title']
]) {
    test(`${button} panel moves without panning the map or moving anchored controls`, async ({
        page
    }) => {
        await page.locator(`#${button}`).click();
        const heading = page.locator(`#${title}`);
        const panel = page.locator('.movable-panel').filter({ has: heading });
        const before = await panel.boundingBox();
        const toolbar = await page.locator('#settings-button').boundingBox();
        const legend = await page.locator('.legend').boundingBox();
        const mapView = await page.locator('#map').getAttribute('class');
        const tileTransform = await page.locator('.leaflet-map-pane').getAttribute('style');
        await drag(page, heading, 50, 20);
        const after = await panel.boundingBox();
        expect(after!.x - before!.x).toBeCloseTo(50, 0);
        expect(after!.y - before!.y).toBeCloseTo(20, 0);
        expect(await page.locator('#settings-button').boundingBox()).toEqual(toolbar);
        expect(await page.locator('.legend').boundingBox()).toEqual(legend);
        expect(await page.locator('#map').getAttribute('class')).toBe(mapView);
        expect(await page.locator('.leaflet-map-pane').getAttribute('style')).toBe(tileTransform);
    });
}

test('dragged settings remain editable and closable and reopen in the default position', async ({
    page
}) => {
    await page.locator('#settings-button').click();
    const panel = page.getByRole('dialog', { name: 'Settings' });
    const initial = await panel.boundingBox();
    await drag(page, page.locator('#settings-panel-title'), -80, 0);
    const moved = await panel.boundingBox();
    await page.locator('#title').fill('Moved settings');
    expect(await panel.boundingBox()).toEqual(moved);
    await panel.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(panel).not.toBeVisible();
    await page.locator('#settings-button').click();
    await expect(page.locator('#title')).toHaveValue('Moved settings');
    expect(await panel.boundingBox()).toEqual(initial);
    await page.getByRole('button', { name: 'Close settings panel' }).click();
    await expect(panel).not.toBeVisible();
});

test('panels stay reachable when dragged past edges and the viewport shrinks', async ({ page }) => {
    await page.locator('#settings-button').click();
    const panel = page.getByRole('dialog', { name: 'Settings' });
    await drag(page, page.locator('#settings-panel-title'), -1500, -1500);
    let box = await panel.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    await drag(page, page.locator('#settings-panel-title'), 1500, 1500);
    await page.setViewportSize({ width: 640, height: 600 });
    await expect
        .poll(async () => {
            const resized = await panel.boundingBox();
            return resized!.x + resized!.width;
        })
        .toBeLessThanOrEqual(641);
    box = await panel.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(641);
    expect(box!.y + box!.height).toBeLessThanOrEqual(601);
    await page.getByRole('button', { name: 'Close settings panel' }).click();
});

test('nested Add layer dialog moves independently of its backdrop and parent', async ({ page }) => {
    await page.locator('#layers-button').click();
    const parent = page.locator('#layers-panel');
    const before = await parent.boundingBox();
    await page.getByRole('button', { name: 'Add layer', exact: true }).click();
    const overlay = await page.locator('#add-layer-overlay').boundingBox();
    const dialog = page.locator('#add-layer-dialog');
    const initial = await dialog.boundingBox();
    await drag(page, page.locator('#add-layer-dialog-title'), 70, 30);
    const moved = await dialog.boundingBox();
    expect(moved!.x - initial!.x).toBeCloseTo(70, 0);
    expect(moved!.y - initial!.y).toBeCloseTo(30, 0);
    expect(await parent.boundingBox()).toEqual(before);
    expect(await page.locator('#add-layer-overlay').boundingBox()).toEqual(overlay);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(parent).toBeVisible();
});

test('touch long-press moves a panel while an ordinary swipe scrolls its content', async ({
    page,
    context
}) => {
    const session = await context.newCDPSession(page);
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await page.setViewportSize({ width: 800, height: 650 });
    await page.locator('#settings-button').click();
    const panel = page.getByRole('dialog', { name: 'Settings' });
    const heading = await page.locator('#settings-panel-title').boundingBox();
    const before = await panel.boundingBox();
    const x = heading!.x + 20;
    const y = heading!.y + 10;
    await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y }]
    });
    await expect(panel).toHaveClass(/panel-moving/);
    await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x + 45, y: y + 10 }]
    });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const after = await panel.boundingBox();
    expect(after!.x - before!.x).toBeCloseTo(45, 0);
    expect(after!.y - before!.y).toBeCloseTo(10, 0);
    await expect(panel).not.toHaveClass(/panel-moving/);

    const body = panel.locator('.overflow-y-auto');
    const bodyBox = await body.boundingBox();
    const swipeX = bodyBox!.x + 15;
    const swipeY = bodyBox!.y + bodyBox!.height - 30;
    await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: swipeX, y: swipeY }]
    });
    for (let step = 1; step <= 5; step++) {
        await session.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: swipeX, y: swipeY - step * 25 }]
        });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await panel.boundingBox()).toEqual(after);
});

for (const stage of ['pending', 'active']) {
    test(`a second finger on the map cancels a ${stage} panel touch drag`, async ({
        page,
        context
    }) => {
        const session = await context.newCDPSession(page);
        await session.send('Emulation.setTouchEmulationEnabled', { enabled: true });
        await page.locator('#settings-button').click();
        const panel = page.getByRole('dialog', { name: 'Settings' });
        const heading = await page.locator('#settings-panel-title').boundingBox();
        const before = await panel.boundingBox();
        const first = { id: 0, x: heading!.x + 20, y: heading!.y + 10 };
        const second = { id: 1, x: 1000, y: 650 };
        await session.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [first]
        });
        if (stage === 'active') {
            await expect(panel).toHaveClass(/panel-moving/);
        }
        await session.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [first, second]
        });
        await expect(panel).not.toHaveClass(/panel-moving/);
        // The pending hold must not activate after the second finger has landed.
        await page.waitForTimeout(500);
        await expect(panel).not.toHaveClass(/panel-moving/);
        await session.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [
                { ...first, x: first.x + 30, y: first.y + 20 },
                { ...second, x: second.x - 30, y: second.y - 20 }
            ]
        });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        expect(await panel.boundingBox()).toEqual(before);
        await expect(page.locator('html')).not.toHaveClass(/panel-dragging/);
    });
}
