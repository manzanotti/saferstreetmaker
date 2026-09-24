import { test } from '@playwright/test';
import { addFreshStorageInitScript, waitForFreshStorage } from '../indexedDbHelpers';

export function setupFreshPage() {
    test.beforeEach(async ({ page, context }) => {
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
                mapEl !== null &&
                Array.from(mapEl.classList).some((className: string) =>
                    className.startsWith('zoom-')
                )
            );
        });
    });
}
