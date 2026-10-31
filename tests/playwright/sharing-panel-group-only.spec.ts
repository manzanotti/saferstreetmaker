import { test, expect } from '@playwright/test';
import { addFreshStorageInitScript, waitForFreshStorage } from './indexedDbHelpers';

test.describe('Sharing Panel', () => {
    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
    });

    test('opening a group-only share does not replace the stored map', async ({
        page,
        context
    }) => {
        const readStoredMap = async (target: typeof page) =>
            await target.evaluate(async () => {
                const database = await new Promise<IDBDatabase>((resolve, reject) => {
                    const request = indexedDB.open('SaferStreetMakerDB');
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
                const record = await new Promise<any>((resolve, reject) => {
                    const request = database
                        .transaction('maps')
                        .objectStore('maps')
                        .get('Full Map');
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
                database.close();
                return {
                    zoom: record?.payload.s.z as number | undefined,
                    groupCount: record?.payload.g?.length as number | undefined,
                    updatedAt: record?.updatedAt as string | undefined
                };
            });
        await page.evaluate(() => {
            Object.defineProperty(navigator, 'clipboard', {
                value: {
                    writeText: async (text: string) => {
                        (window as any).__clipboardText = text;
                    }
                },
                configurable: true
            });
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app.config.globalProperties.$pinia;
            const groupStore = pinia._s.get('group');
            for (const [id, name] of [
                ['shared-group', 'Shared Group'],
                ['other-group', 'Other Group']
            ]) {
                groupStore.addGroup({
                    id,
                    name,
                    versions: [{ id: `${id}-version`, name: 'Current', members: [] }],
                    members: []
                });
            }
            pinia._s.get('selection').markGroupSelection('shared-group');
        });
        await page.locator('#settings-button').click();
        await page.locator('#title').fill('Full Map');
        await page.locator('button:has-text("Save")').click();
        await expect(page.locator('#undo-button')).toBeEnabled();
        const originalMap = await readStoredMap(page);
        expect(originalMap.groupCount).toBe(2);

        await page.locator('#share-button').click();
        await page.locator('button:has-text("Create")').click();
        await page.getByRole('button', { name: 'Just Shared Group' }).click();
        const iframeUrl = await page.evaluate(
            () => (window as any).__clipboardText.match(/src="([^"]+)"/)?.[1] as string
        );
        expect(iframeUrl).toContain('version=1');
        await page.close();
        const sharedPage = await context.newPage();
        await sharedPage.goto(iframeUrl);
        await sharedPage.waitForFunction(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            return app?.config.globalProperties.$pinia._s.get('group').groups.length === 1;
        });
        await sharedPage.keyboard.press('Control+z');
        await sharedPage.keyboard.press('Control+y');
        await sharedPage.waitForTimeout(100);
        const sharedGroupCount = await sharedPage.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            return app.config.globalProperties.$pinia._s.get('group').groups.length;
        });
        expect(sharedGroupCount).toBe(1);
        expect(await readStoredMap(sharedPage)).toEqual(originalMap);
        await sharedPage.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const mapStore = app.config.globalProperties.$pinia._s.get('map');
            const map = mapStore.map;
            map.setZoom(map.getZoom() + 1);
            mapStore.markLayerUpdated();
        });
        await sharedPage.waitForTimeout(700);
        expect(await readStoredMap(sharedPage)).toEqual(originalMap);

        await sharedPage.goto('/');
        await sharedPage.waitForFunction(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            return app?.config.globalProperties.$pinia._s.get('group').groups.length > 0;
        });
        const groupNames = await sharedPage.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            return app.config.globalProperties.$pinia._s
                .get('group')
                .groups.map((group: { name: string }) => group.name);
        });
        expect(groupNames).toEqual(['Shared Group', 'Other Group']);

        const storedZoom = (await readStoredMap(sharedPage)).zoom;
        const nextZoom = await sharedPage.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const map = app.config.globalProperties.$pinia._s.get('map').map;
            const targetZoom = map.getZoom() + 2;
            map.setZoom(targetZoom);
            return targetZoom;
        });
        expect(nextZoom).not.toBe(storedZoom);
        await expect.poll(async () => (await readStoredMap(sharedPage)).zoom).toBe(nextZoom);
        expect((await readStoredMap(sharedPage)).groupCount).toBe(2);
    });
});
