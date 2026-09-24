import { expect, type Page, type BrowserContext } from '@playwright/test';
import { addFreshStorageInitScript, waitForFreshStorage } from '../indexedDbHelpers';

export async function setupPage(page: Page, context: BrowserContext) {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 52.5, longitude: -1.9 });
    await addFreshStorageInitScript(page);
    await page.goto('/');
    await waitForFreshStorage(page);
    await page.addStyleTag({ content: '#help { display: none !important; }' });
    await page.waitForSelector('.toolbar');
    await page.waitForFunction(() => {
        const mapEl = document.getElementById('map');
        return (
            mapEl !== null && Array.from(mapEl.classList).some((c: string) => c.startsWith('zoom-'))
        );
    });
}

export async function placeModalFilter(page: Page, offsetX = 0, offsetY = 0): Promise<void> {
    await page.locator('#modal-filter-button').click();
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    await page.mouse.click(box.x + box.width / 2 + offsetX, box.y + box.height / 2 + offsetY);
    await page.waitForTimeout(150);
}

export async function dragSelectCenter(
    page: Page,
    halfSize = 80,
    offsetX = 0,
    offsetY = 0
): Promise<void> {
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    const cx = box.x + box.width / 2 + offsetX;
    const cy = box.y + box.height / 2 + offsetY;
    await page.mouse.move(cx - halfSize, cy - halfSize);
    await page.mouse.down();
    await page.mouse.move(cx + halfSize, cy + halfSize, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);
}

export async function dragSelectLastModalFilter(page: Page): Promise<void> {
    const marker = page.locator('.leaflet-filters-pane path.modal-filter-marker').last();
    await marker.dispatchEvent('click');
    await page.waitForTimeout(200);
}

export async function placeTwoModalFilters(page: Page, offset = 70, offsetY = 0): Promise<void> {
    await page.locator('#modal-filter-button').click();
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2 + offsetY;
    await page.mouse.click(cx - offset, cy);
    await page.waitForTimeout(150);
    await page.mouse.click(cx + offset, cy);
    await page.waitForTimeout(150);
    await page.locator('#modal-filter-button').click();
}

export async function selectBothFilters(page: Page, offsetX = 0, offsetY = 0): Promise<void> {
    await page.locator('#select-area-button').click();
    await dragSelectCenter(page, 120, offsetX, offsetY);
    await expect(page.getByText('2 features selected')).toBeVisible();
}

export async function openGroupsPanel(page: Page): Promise<void> {
    await page.locator('#groups-button').click();
}

export async function openGroupDetails(page: Page, name: string): Promise<void> {
    const dialog = page.getByRole('dialog', { name: 'Group details' });
    if (await dialog.isVisible()) {
        return;
    }
    const groupButton = page.getByRole('button', { name: `Select group ${name}` });
    if (!(await groupButton.isVisible())) {
        const groupsButton = page.locator('#groups-button');
        if ((await groupsButton.getAttribute('aria-pressed')) !== 'true') {
            await groupsButton.click();
        }
    }
    await groupButton.click();
    await page.waitForTimeout(100);
    await expect(dialog).toBeVisible();
}

export async function createGroup(page: Page, name: string): Promise<void> {
    await page.getByRole('button', { name: 'Add selected features to a group' }).click();
    await page.waitForSelector('#group-name-input');
    await page.locator('#group-name-input').fill(name);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(300);
}

export async function createGroupWithDescription(
    page: Page,
    name: string,
    description: string
): Promise<void> {
    await page.getByRole('button', { name: 'Add selected features to a group' }).click();
    await page.waitForSelector('#group-name-input');
    await page.locator('#group-name-input').fill(name);
    await page.locator('#group-description-input').fill(description);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(300);
}

export async function setGroupPhases(page: Page, phaseCount: number): Promise<void> {
    await page.evaluate((count) => {
        const app = (document.getElementById('app') as any).__vue_app__;
        const groupStore = app?.config?.globalProperties?.$pinia?._s?.get('group');
        const group = groupStore.groups[0];
        const version = groupStore.getActiveGroupVersion(group.id);
        const phases = Array.from({ length: count }, (_, index) => ({
            id: `read-only-phase-${index + 1}`,
            members: [version.members[index % version.members.length]]
        }));
        groupStore.replaceVersionPhases(group.id, version.id, phases);
    }, phaseCount);
}

export async function createGroupVersion(page: Page, name: string): Promise<void> {
    const dialog = page.getByRole('dialog', { name: 'Group details' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Create version' }).click();
    await dialog.getByLabel('New version').fill(name);
    await dialog.getByLabel('Versions').getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(300);
    if (!(await dialog.isVisible())) {
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Versioned Group');
    }
}

export async function expectSelectedVersion(page: Page, name: string): Promise<void> {
    await expect(page.getByRole('button', { name: `Select version ${name}` })).toHaveAttribute(
        'aria-pressed',
        'true'
    );
}

export async function drawNamedLtnCell(page: Page, name: string, offsetX = 0): Promise<void> {
    await page.locator('#ltn-button').click();
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.waitForTimeout(200);
    await page.mouse.click(cx - 45 + offsetX, cy - 35);
    await page.waitForTimeout(200);
    await page.mouse.click(cx + 45 + offsetX, cy - 35);
    await page.waitForTimeout(200);
    await page.mouse.click(cx + offsetX, cy + 35);
    await page.waitForTimeout(200);
    await page.mouse.dblclick(cx + offsetX, cy + 35);
    const labelInput = page.locator('.label-editor');
    await expect(labelInput).toBeVisible();
    await labelInput.fill(name);
    await labelInput.press('Enter');
    await page.locator('#ltn-button').click();
    await page.waitForTimeout(300);
}

export async function drawNamedMobilityLane(page: Page, name: string): Promise<void> {
    await page.locator('#mobility-lane-button').click();
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.waitForTimeout(200);
    await page.mouse.click(cx - 60, cy);
    await page.waitForTimeout(200);
    await page.mouse.click(cx + 60, cy);
    await page.waitForTimeout(200);
    await page.mouse.dblclick(cx + 60, cy + 60);
    const labelInput = page.locator('.leaflet-popup .label-editor');
    await expect(labelInput).toHaveCount(0);
    await page.locator('#mobility-lane-button').click();
    await page.waitForTimeout(300);
}
