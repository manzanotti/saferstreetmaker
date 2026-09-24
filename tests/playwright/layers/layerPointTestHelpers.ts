import { expect, type Page } from '@playwright/test';

export async function setMapZoom(page: Page, zoom: number): Promise<void> {
    await page.evaluate((nextZoom) => {
        const app = (document.getElementById('app') as any).__vue_app__;
        const mapStore = app?.config?.globalProperties?.$pinia?._s?.get('map');
        mapStore.map.setZoom(nextZoom, { animate: false });
    }, zoom);
    await page.waitForFunction(
        (nextZoom) => document.getElementById('map')?.classList.contains(`zoom-${nextZoom}`),
        zoom
    );
}

export async function getPointIconState(page: Page, selector: string, index = 0) {
    return await page
        .locator(selector)
        .nth(index)
        .evaluate((element) => {
            const mapElement = document.getElementById('map');
            const rect = element.getBoundingClientRect();
            const app = (document.getElementById('app') as any).__vue_app__;
            const map = app?.config?.globalProperties?.$pinia?._s?.get('map').map;
            let featureLatLng: { lat: number; lng: number } | null = null;

            const visitLayer = (layer: any) => {
                if (featureLatLng) {
                    return;
                }
                if (layer.getElement?.() === element && layer.getLatLng) {
                    featureLatLng = layer.getLatLng();
                    return;
                }
                layer.eachLayer?.(visitLayer);
            };
            map.eachLayer(visitLayer);

            if (!featureLatLng) {
                throw new Error(`Leaflet layer not found for ${selector}`);
            }

            const expectedAnchor = map.latLngToContainerPoint(featureLatLng);
            const mapRect = mapElement?.getBoundingClientRect();
            const visualStyle = getComputedStyle(element, '::before');
            const transformMatch = visualStyle.transform.match(/^matrix\(([^,]+),/);
            const visualScale = transformMatch ? Number(transformMatch[1]) : 1;
            const [originX = 0, originY = 0] = visualStyle.transformOrigin
                .split(' ')
                .map(Number.parseFloat);
            const visualLeft = rect.left + originX * (1 - visualScale);
            const visualTop = rect.top + originY * (1 - visualScale);
            return {
                size: getComputedStyle(element).zoom,
                visibility: getComputedStyle(element).visibility,
                anchor: {
                    x: rect.left + rect.width / 2 - (mapRect?.left ?? 0),
                    y: rect.top + rect.height / 2 - (mapRect?.top ?? 0)
                },
                visualAnchor: {
                    x: visualLeft + (rect.width * visualScale) / 2 - (mapRect?.left ?? 0),
                    y: visualTop + (rect.height * visualScale) / 2 - (mapRect?.top ?? 0)
                },
                expectedAnchor,
                width: rect.width,
                height: rect.height,
                visualTransform: getComputedStyle(element, '::before').transform,
                visualTransformOrigin: getComputedStyle(element, '::before').transformOrigin
            };
        });
}

export function expectPointAtLeafletCoordinate(
    state: Awaited<ReturnType<typeof getPointIconState>>
) {
    expect(Math.abs(state.visualAnchor.x - state.expectedAnchor.x)).toBeLessThan(1);
    expect(Math.abs(state.visualAnchor.y - state.expectedAnchor.y)).toBeLessThan(1);
}
