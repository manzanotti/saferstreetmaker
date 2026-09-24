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

test.describe('Layer: Mobility Lane (polyline): geometry', () => {
    setupFreshPage();

    test('undo restores an edited mobility lane geometry and redo reapplies it', async ({
        page
    }) => {
        await page.locator('#mobility-lane-button').click();
        await drawPolyline(page);
        await page.locator('#mobility-lane-button').click();

        // Access the Leaflet map via the Vue app's Pinia store — no production code
        // changes required: the map store is reachable through the mounted Vue app.
        // NOTE: `_s` is Pinia's internal store registry Map. It is not part of the
        // documented public API but has been stable across Pinia v2/v3. The no-src-change
        // policy means this is the appropriate access path here — see copilot-instructions.md.
        const originalData: { historyId: string; coords: number[][] } | null = await page.evaluate(
            () => {
                const app = (document.getElementById('app') as any).__vue_app__;
                const pinia = app?.config?.globalProperties?.$pinia;
                const map = pinia?._s?.get('map')?.map ?? null;
                if (!map) {
                    return null;
                }
                const data: { historyId: string; coords: number[][] }[] = [];
                map.eachLayer((l: any) => {
                    if (
                        l.feature?.properties?.historyId &&
                        l.feature?.geometry?.type === 'LineString' &&
                        l.getLatLngs &&
                        data.length === 0
                    ) {
                        data.push({
                            historyId: l.feature.properties.historyId,
                            coords: l.getLatLngs().map((ll: any) => [ll.lng, ll.lat])
                        });
                    }
                });
                return data[0] ?? null;
            }
        );

        if (!originalData || originalData.coords.length < 2) {
            throw new Error('Expected a mobility lane with at least two coordinates');
        }

        const editedCoords = originalData.coords.map((c, i) =>
            i === originalData.coords.length - 1 ? [c[0] + 0.005, c[1] + 0.005] : c
        );

        await page.evaluate(
            ({ edited, historyId }) => {
                const app = (document.getElementById('app') as any).__vue_app__;
                const pinia = app?.config?.globalProperties?.$pinia;
                const map = pinia?._s?.get('map')?.map ?? null;
                if (!map) {
                    return;
                }
                map.eachLayer((l: any) => {
                    if (l.feature?.properties?.historyId === historyId && l.setLatLngs) {
                        l.setLatLngs(edited.map((c: number[]) => ({ lat: c[1], lng: c[0] })));
                        l.fire('edit');
                    }
                });
            },
            { edited: editedCoords, historyId: originalData.historyId }
        );
        await page.waitForTimeout(300);

        await page.locator('#undo-button').click();
        await page.waitForTimeout(200);

        const afterUndo: number[][] = await page.evaluate((historyId) => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app?.config?.globalProperties?.$pinia;
            const map = pinia?._s?.get('map')?.map ?? null;
            if (!map) {
                return [];
            }
            let coords: number[][] = [];
            map.eachLayer((l: any) => {
                if (l.feature?.properties?.historyId === historyId && l.getLatLngs) {
                    coords = l
                        .getLatLngs()
                        .map((ll: any) => [
                            Math.round(ll.lng * 1e6) / 1e6,
                            Math.round(ll.lat * 1e6) / 1e6
                        ]);
                }
            });
            return coords;
        }, originalData.historyId);

        const roundedOriginal = originalData.coords.map((c) => [
            Math.round(c[0] * 1e6) / 1e6,
            Math.round(c[1] * 1e6) / 1e6
        ]);
        expect(afterUndo).toEqual(roundedOriginal);

        await page.locator('#redo-button').click();
        await page.waitForTimeout(200);

        const afterRedo: number[][] = await page.evaluate((historyId) => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app?.config?.globalProperties?.$pinia;
            const map = pinia?._s?.get('map')?.map ?? null;
            if (!map) {
                return [];
            }
            let coords: number[][] = [];
            map.eachLayer((l: any) => {
                if (l.feature?.properties?.historyId === historyId && l.getLatLngs) {
                    coords = l
                        .getLatLngs()
                        .map((ll: any) => [
                            Math.round(ll.lng * 1e6) / 1e6,
                            Math.round(ll.lat * 1e6) / 1e6
                        ]);
                }
            });
            return coords;
        }, originalData.historyId);

        const roundedEdited = editedCoords.map((c) => [
            Math.round(c[0] * 1e6) / 1e6,
            Math.round(c[1] * 1e6) / 1e6
        ]);
        expect(afterRedo).toEqual(roundedEdited);
    });
});
