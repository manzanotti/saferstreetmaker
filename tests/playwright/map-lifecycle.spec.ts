import { expect, test } from '@playwright/test';
import { setupPage } from './groups/groupTestHelpers';

type TestRoot = HTMLElement & {
    __vue_app__?: {
        config: {
            globalProperties: {
                $pinia: {
                    _s: Map<string, { map?: import('leaflet').Map; activePanel?: string | null }>;
                };
            };
        };
    };
};

test('removing the map unmounts its controls and releases keyboard shortcuts', async ({
    page,
    context
}) => {
    await setupPage(page, context);

    const result = await page.evaluate(() => {
        const root = document.getElementById('app') as TestRoot | null;
        const map = root?.__vue_app__?.config.globalProperties.$pinia._s.get('map')?.map;
        if (!map) {
            throw new Error('Map was not mounted');
        }
        const controls = Array.from(
            map.getContainer().querySelectorAll('.leaflet-control')
        ) as Array<HTMLElement & { __vue_app__?: unknown }>;
        const mounted = controls.filter((control) => control.__vue_app__);
        map.remove();
        return {
            mounted: mounted.length,
            unmounted: mounted.filter((control) => !control.__vue_app__).length
        };
    });

    expect(result.mounted).toBe(4);
    expect(result.unmounted).toBe(result.mounted);
    await page.keyboard.press('l');
    await expect
        .poll(() =>
            page.evaluate(() => {
                const root = document.getElementById('app') as TestRoot | null;
                return root?.__vue_app__?.config.globalProperties.$pinia._s.get('ui')?.activePanel;
            })
        )
        .toBeNull();
});
