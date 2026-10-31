import { expect, test } from '@playwright/test';
import { setupPage, openGroupsPanel } from './groupTestHelpers';
import { seedIsolationMap } from './groupVisibilityTestHelpers';

test('a shared feature stays visible until every group containing it is hidden', async ({
    page,
    context
}) => {
    await setupPage(page, context);
    await seedIsolationMap(page);
    await openGroupsPanel(page);

    const shared = page.locator('[data-fixture="shared-cell"]');
    await page.getByRole('button', { name: 'Hide group Proposal', exact: true }).click();
    await expect(shared).toHaveAttribute('stroke-opacity', '1');
    await page.getByRole('button', { name: 'Hide group Other', exact: true }).click();
    await expect(shared).toHaveAttribute('stroke-opacity', '0');
    await expect(shared).toHaveCSS('pointer-events', 'none');
});
