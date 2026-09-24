import { test, expect } from '@playwright/test';
import { setupFreshPage } from './layerTestSetup';
import {
    getLayerFeatureCount,
    clickMap,
    waitForHistoryButtons,
    drawPolyline,
    drawPolygon,
    drawPolygonClosingAtFirstVertex,
    deleteFirstShape
} from './layerMapTestHelpers';
import { clickSvgPath, hoverSvgPathStroke } from './layerSvgTestHelpers';
import { hoverLocatorCenter } from './layerHoverTestHelpers';
import {
    getInlineCursor,
    getCursorAtLocatorCenter,
    getCursorAtPagePoint,
    moveToMapOffset
} from './layerCursorTestHelpers';

test.describe('Layer: LTN Cell (polygon): polygon-geometry', () => {
    setupFreshPage();

    test('undo restores an edited LTN polygon vertex geometry and redo reapplies it', async ({
        page
    }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        await page.locator('#ltn-button').click();

        const originalData: { historyId: string; coords: number[][][] } | null =
            await page.evaluate(() => {
                const app = (document.getElementById('app') as any).__vue_app__;
                const pinia = app?.config?.globalProperties?.$pinia;
                const map = pinia?._s?.get('map')?.map ?? null;
                if (!map) return null;
                const data: { historyId: string; coords: number[][][] }[] = [];
                map.eachLayer((l: any) => {
                    if (
                        l.feature?.properties?.historyId &&
                        l.feature?.geometry?.type === 'Polygon' &&
                        l.getLatLngs &&
                        data.length === 0
                    ) {
                        const rings = l.getLatLngs() as any[][];
                        data.push({
                            historyId: l.feature.properties.historyId,
                            coords: rings.map((ring: any[]) =>
                                ring.map((ll: any) => [ll.lng, ll.lat])
                            )
                        });
                    }
                });
                return data[0] ?? null;
            });

        if (
            !originalData ||
            originalData.coords.length === 0 ||
            originalData.coords[0].length < 3
        ) {
            return;
        }

        // Shift the last vertex of the outer ring by a small amount.
        const editedCoords = originalData.coords.map((ring, ri) =>
            ring.map((c, ci) =>
                ri === 0 && ci === ring.length - 1 ? [c[0] + 0.005, c[1] + 0.005] : c
            )
        );

        await page.evaluate(
            ({ edited, historyId }) => {
                const app = (document.getElementById('app') as any).__vue_app__;
                const pinia = app?.config?.globalProperties?.$pinia;
                const map = pinia?._s?.get('map')?.map ?? null;
                if (!map) return;
                map.eachLayer((l: any) => {
                    if (l.feature?.properties?.historyId === historyId && l.setLatLngs) {
                        l.setLatLngs(
                            edited.map((ring: number[][]) =>
                                ring.map((c: number[]) => ({ lat: c[1], lng: c[0] }))
                            )
                        );
                        l.fire('edit');
                    }
                });
            },
            { edited: editedCoords, historyId: originalData.historyId }
        );
        await page.waitForTimeout(300);

        await page.locator('#undo-button').click();
        await page.waitForTimeout(200);

        const afterUndo: number[][][] = await page.evaluate((historyId) => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app?.config?.globalProperties?.$pinia;
            const map = pinia?._s?.get('map')?.map ?? null;
            if (!map) return [];
            let coords: number[][][] = [];
            map.eachLayer((l: any) => {
                if (l.feature?.properties?.historyId === historyId && l.getLatLngs) {
                    const rings = l.getLatLngs() as any[][];
                    coords = rings.map((ring: any[]) =>
                        ring.map((ll: any) => [
                            Math.round(ll.lng * 1e6) / 1e6,
                            Math.round(ll.lat * 1e6) / 1e6
                        ])
                    );
                }
            });
            return coords;
        }, originalData.historyId);

        const roundedOriginal = originalData.coords.map((ring) =>
            ring.map((c) => [Math.round(c[0] * 1e6) / 1e6, Math.round(c[1] * 1e6) / 1e6])
        );
        expect(afterUndo).toEqual(roundedOriginal);

        await page.locator('#redo-button').click();
        await page.waitForTimeout(200);

        const afterRedo: number[][][] = await page.evaluate((historyId) => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app?.config?.globalProperties?.$pinia;
            const map = pinia?._s?.get('map')?.map ?? null;
            if (!map) return [];
            let coords: number[][][] = [];
            map.eachLayer((l: any) => {
                if (l.feature?.properties?.historyId === historyId && l.getLatLngs) {
                    const rings = l.getLatLngs() as any[][];
                    coords = rings.map((ring: any[]) =>
                        ring.map((ll: any) => [
                            Math.round(ll.lng * 1e6) / 1e6,
                            Math.round(ll.lat * 1e6) / 1e6
                        ])
                    );
                }
            });
            return coords;
        }, originalData.historyId);

        const roundedEdited = editedCoords.map((ring) =>
            ring.map((c) => [Math.round(c[0] * 1e6) / 1e6, Math.round(c[1] * 1e6) / 1e6])
        );
        expect(afterRedo).toEqual(roundedEdited);
    });
});
