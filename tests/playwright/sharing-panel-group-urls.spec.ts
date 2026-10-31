import { test, expect } from '@playwright/test';
import { addFreshStorageInitScript, waitForFreshStorage } from './indexedDbHelpers';

test.describe('Sharing Panel', () => {
    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
    });

    test('shared group URLs select the active version in read-only mode', async ({ page }) => {
        await page.addInitScript(() => {
            (window as any).__clipboardText = '';
            Object.defineProperty(navigator, 'clipboard', {
                value: {
                    writeText: (text: string) => (
                        ((window as any).__clipboardText = text),
                        Promise.resolve()
                    )
                },
                configurable: true
            });
        });
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
        await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app.config.globalProperties.$pinia;
            const groupStore = pinia._s.get('group');
            const selectionStore = pinia._s.get('selection');
            groupStore.addGroup({
                id: 'shared-group',
                name: 'Shared Group',
                description: 'A shared group',
                defaultVersionId: 'version-2',
                versions: [
                    { id: 'version-1', name: 'First', members: [] },
                    { id: 'version-2', name: 'Second', members: [] }
                ],
                members: []
            });
            selectionStore.markGroupSelection('shared-group');
        });

        await page.locator('#share-button').click();
        await page.locator('#width').fill('320');
        await page.locator('#height').fill('240');
        await page.locator('button:has-text("Create")').click();
        await page.getByRole('button', { name: 'Just Shared Group' }).click();
        const iframeUrl = await page.evaluate(() => {
            const src = (window as any).__clipboardText.match(/src="([^"]+)"/)?.[1];
            return src;
        });
        expect(iframeUrl).toContain('group=shared-group');
        expect(iframeUrl).toContain('version=2');
        expect(iframeUrl).toContain('share=1');

        await page.goto(iframeUrl);
        await expect(page.getByRole('dialog', { name: 'Shared Group' })).toBeVisible();
        await expect(page.locator('#groups-button')).not.toBeAttached();
    });

    test('sharing a selected group asks which scope to include', async ({ page }) => {
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
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
            const selectionStore = pinia._s.get('selection');
            groupStore.addGroup({
                id: 'scope-group',
                name: 'Cycle Route',
                versions: [{ id: 'scope-version', name: 'Current', members: [] }],
                members: []
            });
            groupStore.addGroup({
                id: 'other-group',
                name: 'Other Group',
                versions: [{ id: 'other-version', name: 'Current', members: [] }],
                members: []
            });
            selectionStore.markGroupSelection('scope-group');
        });

        await page.locator('#share-button').click();
        await page.locator('button:has-text("Create")').click();

        const prompt = page.getByRole('alertdialog', { name: 'Share Cycle Route' });
        await expect(prompt).toBeVisible();
        await expect(prompt.getByRole('button', { name: 'Whole map' })).toBeVisible();
        await expect(prompt.getByRole('button', { name: 'Just Cycle Route' })).toBeVisible();
        await expect(prompt.getByRole('button', { name: 'Cancel' })).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(prompt).not.toBeVisible();
        await expect(page.locator('#sharing')).toBeVisible();

        await page.getByRole('button', { name: 'Create' }).click();
        await expect(prompt).toBeVisible();
        await prompt.getByRole('button', { name: 'Whole map' }).click();
        const iframeUrl = await page.evaluate(
            () => (window as any).__clipboardText.match(/src="([^"]+)"/)?.[1] as string
        );
        const params = new URL(iframeUrl).searchParams;
        expect(params.has('group')).toBe(false);
        expect(params.has('version')).toBe(false);
        expect(params.get('share')).toBe('1');

        await page.goto(iframeUrl);
        await page.waitForFunction(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            return app?.config.globalProperties.$pinia._s.get('group').groups.length === 2;
        });
        await expect(page.locator('#groups-button')).toBeVisible();
    });

    test('shared group URLs omit an invalid active version', async ({ page }) => {
        await page.addInitScript(() => {
            (window as any).__clipboardText = '';
            Object.defineProperty(navigator, 'clipboard', {
                value: {
                    writeText: (text: string) => (
                        ((window as any).__clipboardText = text),
                        Promise.resolve()
                    )
                },
                configurable: true
            });
        });
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
        await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app.config.globalProperties.$pinia;
            const groupStore = pinia._s.get('group');
            const selectionStore = pinia._s.get('selection');
            groupStore.addGroup({
                id: 'stale-version-group',
                name: 'Stale Version Group',
                defaultVersionId: 'version-1',
                versions: [{ id: 'version-1', name: 'First', members: [] }],
                members: []
            });
            groupStore.activeVersionIds = { 'stale-version-group': 'missing-version' };
            selectionStore.markGroupSelection('stale-version-group');
        });

        await page.locator('#share-button').click();
        await page.locator('#width').fill('320');
        await page.locator('#height').fill('240');
        await page.locator('button:has-text("Create")').click();
        await page.getByRole('button', { name: 'Just Stale Version Group' }).click();
        const iframeUrl = await page.evaluate(() => {
            const src = (window as any).__clipboardText.match(/src="([^"]+)"/)?.[1];
            return src;
        });

        expect(iframeUrl).toContain('group=stale-version-group');
        expect(iframeUrl).not.toContain('version=0');
        expect(iframeUrl).not.toContain('version=');
    });
});
