import { test, expect } from '@playwright/test';
import {
    setupPage,
    placeModalFilter,
    drawNamedMobilityLane,
    dragSelectCenter,
    createGroupWithDescription,
    setGroupPhases
} from './groupTestHelpers';

test('grouped points and lines keep their hover behavior in both modes', async ({
    page,
    context
}) => {
    await setupPage(page, context);
    await placeModalFilter(page, 110);
    await drawNamedMobilityLane(page, 'School lane');
    await page.locator('#select-area-button').click();
    await dragSelectCenter(page, 160);
    await expect(page.getByText('2 features selected')).toBeVisible();
    await createGroupWithDescription(page, 'School Zone', '<p>School route</p>');
    await setGroupPhases(page, 1);

    const features = [
        page.locator('.leaflet-filters-pane path.modal-filter-marker').first(),
        page.locator('.leaflet-overlay-pane path.mobility-lane.leaflet-interactive').first()
    ];
    for (const feature of features) {
        await feature.dispatchEvent('mouseover');
        const popup = page.locator('.leaflet-popup.feature-popup-hover');
        await expect(popup).toContainText('School Zone');
        await feature.dispatchEvent('mouseout');
        await expect(popup).toHaveCount(0);
    }

    await page.locator('#settings-button').click();
    await page.locator('#read-only').check();
    await page.getByRole('button', { name: 'Save' }).click();
    for (const feature of features) {
        await feature.dispatchEvent('mouseover');
        const popup = page.locator('.leaflet-popup.group-popup');
        await expect(popup.locator('.group-popup-title')).toHaveText('School Zone');
        await expect(feature).toHaveCSS('cursor', 'pointer');
        await feature.dispatchEvent('mouseout');
        await expect(popup).toHaveCount(0);
    }
});
