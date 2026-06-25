import { test, expect, Page } from '@playwright/test';
import {
    addFreshStorageInitScript,
    getLayerFeatureCount as getIndexedDbLayerFeatureCount
} from './indexedDbHelpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getLayerFeatureCount(page: Page, layerId: string): Promise<number> {
    return await getIndexedDbLayerFeatureCount(page, 'Hello Cleveland', layerId);
}

/** Click at a position relative to the centre of the Leaflet map. */
async function clickMap(page: Page, offsetX = 0, offsetY = 0) {
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    await page.mouse.click(box.x + box.width / 2 + offsetX, box.y + box.height / 2 + offsetY);
    // Layer click handlers call mapStore.markLayerUpdated() synchronously, which
    // triggers a save via a Pinia watch. The short pause lets the persistence
    // work settle before we read IndexedDB.
    await page.waitForTimeout(100);
}

/** Draw a two-vertex polyline by clicking twice then double-clicking to finish.
 * Delays between clicks are required: rapid CDP events confuse leaflet.draw's
 * internal state machine, preventing draw:created from firing.
 */
async function drawPolyline(page: Page) {
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.waitForTimeout(200); // let Vue reactivity settle after button click
    await page.mouse.click(cx - 60, cy);
    await page.waitForTimeout(200);
    await page.mouse.click(cx + 60, cy);
    await page.waitForTimeout(200);
    await page.mouse.dblclick(cx + 60, cy + 60);
    await page.waitForTimeout(500); // wait for the debounced save (draw:created → markLayerUpdated → saveMap)
}

/** Draw a three-vertex polygon by clicking three times then double-clicking to finish. */
async function drawPolygon(page: Page) {
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.waitForTimeout(200);
    await page.mouse.click(cx - 60, cy - 40);
    await page.waitForTimeout(200);
    await page.mouse.click(cx + 60, cy - 40);
    await page.waitForTimeout(200);
    await page.mouse.click(cx, cy + 40);
    await page.waitForTimeout(200);
    await page.mouse.dblclick(cx, cy + 60);
    await page.waitForTimeout(500);
}

async function deleteFirstShape(page: Page) {
    await page
        .locator('.leaflet-overlay-pane path, .leaflet-polygon-pane path, .leaflet-ltns-pane path')
        .first()
        .dispatchEvent('click');
    await page.waitForSelector('.popup-buttons .delete-button');
    await page.locator('.popup-buttons .delete-button').first().dispatchEvent('click');
    await page.waitForTimeout(100);
}

async function hoverSvgPath(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
    const point = await locator.first().evaluate((element) => {
        const path = element as SVGPathElement;
        const screenMatrix = path.getScreenCTM();

        if (!screenMatrix) {
            throw new Error('SVG path screen transform unavailable');
        }

        const toScreenPoint = (distance: number, offsetX: number, offsetY: number) => {
            const pointAtDistance = path.getPointAtLength(distance);
            return {
                x:
                    pointAtDistance.x * screenMatrix.a +
                    pointAtDistance.y * screenMatrix.c +
                    screenMatrix.e +
                    offsetX,
                y:
                    pointAtDistance.x * screenMatrix.b +
                    pointAtDistance.y * screenMatrix.d +
                    screenMatrix.f +
                    offsetY
            };
        };

        const length = path.getTotalLength();
        const distances = [0.25, 0.5, 0.75].map((fraction) => length * fraction);
        const offsets = [
            { x: 0, y: 0 },
            { x: -2, y: 0 },
            { x: 2, y: 0 },
            { x: 0, y: -2 },
            { x: 0, y: 2 }
        ];

        for (const distance of distances) {
            for (const offset of offsets) {
                const point = toScreenPoint(distance, offset.x, offset.y);
                const stack = document.elementsFromPoint(point.x, point.y);
                if (stack.includes(path)) {
                    return point;
                }
            }
        }

        return toScreenPoint(length / 2, 0, 0);
    });

    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(100);
}

async function hoverSvgPathStroke(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
    const point = await locator.first().evaluate((element) => {
        const path = element as SVGPathElement;
        const screenMatrix = path.getScreenCTM();

        if (!screenMatrix) {
            throw new Error('SVG path screen transform unavailable');
        }

        const toScreenPoint = (distance: number, offsetX: number, offsetY: number) => {
            const pointAtDistance = path.getPointAtLength(distance);
            return {
                x:
                    pointAtDistance.x * screenMatrix.a +
                    pointAtDistance.y * screenMatrix.c +
                    screenMatrix.e +
                    offsetX,
                y:
                    pointAtDistance.x * screenMatrix.b +
                    pointAtDistance.y * screenMatrix.d +
                    screenMatrix.f +
                    offsetY
            };
        };

        const length = path.getTotalLength();
        const distances = [0.25, 0.5, 0.75].map((fraction) => length * fraction);
        const offsets = [
            { x: -2, y: 0 },
            { x: 2, y: 0 },
            { x: 0, y: -2 },
            { x: 0, y: 2 },
            { x: -3, y: 0 },
            { x: 3, y: 0 },
            { x: 0, y: -3 },
            { x: 0, y: 3 }
        ];

        for (const distance of distances) {
            for (const offset of offsets) {
                const point = toScreenPoint(distance, offset.x, offset.y);
                const hit = document.elementFromPoint(point.x, point.y);
                if (hit === path) {
                    return point;
                }
            }
        }

        throw new Error('No path stroke point found for hover probe');
    });

    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(100);
}

async function hoverLocatorCenter(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
    const box = await locator.first().boundingBox();
    if (!box) {
        throw new Error('Hovered element bounding box unavailable');
    }

    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(100);
}

async function getCursorAtPathPoint(locator: ReturnType<Page['locator']>): Promise<string> {
    return await locator.first().evaluate((element) => {
        const path = element as SVGPathElement;
        const screenMatrix = path.getScreenCTM();

        if (!screenMatrix) {
            throw new Error('SVG path screen transform unavailable');
        }

        const toScreenPoint = (distance: number, offsetX: number, offsetY: number) => {
            const pointAtDistance = path.getPointAtLength(distance);
            return {
                x:
                    pointAtDistance.x * screenMatrix.a +
                    pointAtDistance.y * screenMatrix.c +
                    screenMatrix.e +
                    offsetX,
                y:
                    pointAtDistance.x * screenMatrix.b +
                    pointAtDistance.y * screenMatrix.d +
                    screenMatrix.f +
                    offsetY
            };
        };

        const length = path.getTotalLength();
        const distances = [0.25, 0.5, 0.75].map((fraction) => length * fraction);
        const offsets = [
            { x: 0, y: 0 },
            { x: -2, y: 0 },
            { x: 2, y: 0 },
            { x: 0, y: -2 },
            { x: 0, y: 2 }
        ];

        let hit: Element | null = null;

        for (const distance of distances) {
            for (const offset of offsets) {
                const point = toScreenPoint(distance, offset.x, offset.y);
                const stack = document.elementsFromPoint(point.x, point.y);
                if (stack.includes(path)) {
                    hit = document.elementFromPoint(point.x, point.y);
                    break;
                }
            }

            if (hit) {
                break;
            }
        }

        if (!hit) {
            const fallbackPoint = toScreenPoint(length / 2, 0, 0);
            hit = document.elementFromPoint(fallbackPoint.x, fallbackPoint.y);
        }

        if (!hit) {
            throw new Error('No element found at SVG path point');
        }

        return getComputedStyle(hit).cursor;
    });
}

async function getCursorAtPathStroke(locator: ReturnType<Page['locator']>): Promise<string> {
    return await locator.first().evaluate((element) => {
        const path = element as SVGPathElement;
        const screenMatrix = path.getScreenCTM();

        if (!screenMatrix) {
            throw new Error('SVG path screen transform unavailable');
        }

        const toScreenPoint = (distance: number, offsetX: number, offsetY: number) => {
            const pointAtDistance = path.getPointAtLength(distance);
            return {
                x:
                    pointAtDistance.x * screenMatrix.a +
                    pointAtDistance.y * screenMatrix.c +
                    screenMatrix.e +
                    offsetX,
                y:
                    pointAtDistance.x * screenMatrix.b +
                    pointAtDistance.y * screenMatrix.d +
                    screenMatrix.f +
                    offsetY
            };
        };

        const length = path.getTotalLength();
        const distances = [0.25, 0.5, 0.75].map((fraction) => length * fraction);
        const offsets = [
            { x: -2, y: 0 },
            { x: 2, y: 0 },
            { x: 0, y: -2 },
            { x: 0, y: 2 },
            { x: -3, y: 0 },
            { x: 3, y: 0 },
            { x: 0, y: -3 },
            { x: 0, y: 3 }
        ];

        for (const distance of distances) {
            for (const offset of offsets) {
                const point = toScreenPoint(distance, offset.x, offset.y);
                const hit = document.elementFromPoint(point.x, point.y);
                if (hit === path) {
                    return getComputedStyle(hit).cursor;
                }
            }
        }

        throw new Error('No path stroke point found for cursor probe');
    });
}

async function getInlineCursor(locator: ReturnType<Page['locator']>): Promise<string> {
    return await locator.first().evaluate((element) => {
        if (!(element instanceof HTMLElement || element instanceof SVGElement)) {
            throw new Error('Element does not support inline cursor styles');
        }

        return element.style.cursor;
    });
}

async function getCursorAtLocatorCenter(locator: ReturnType<Page['locator']>): Promise<string> {
    return await locator.first().evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
        );
        if (!hit) {
            throw new Error('No element found at locator center point');
        }

        return getComputedStyle(hit).cursor;
    });
}

async function getCursorAtPagePoint(page: Page, x: number, y: number): Promise<string> {
    return await page.evaluate(
        ({ pointX, pointY }) => {
            const hit = document.elementFromPoint(pointX, pointY);
            if (!hit) {
                throw new Error('No element found at page point');
            }

            return getComputedStyle(hit).cursor;
        },
        { pointX: x, pointY: y }
    );
}

async function moveToMapOffset(
    page: Page,
    offsetX: number,
    offsetY: number
): Promise<{ x: number; y: number }> {
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) {
        throw new Error('Map bounding box not found');
    }

    const point = {
        x: box.x + box.width / 2 + offsetX,
        y: box.y + box.height / 2 + offsetY
    };
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(100);

    return point;
}

// ---------------------------------------------------------------------------
// Shared beforeEach – clear storage so each test starts from a blank map
// ---------------------------------------------------------------------------

function setupFreshPage() {
    test.beforeEach(async ({ page, context }) => {
        // Provide a fixed geolocation so the map view is set during page load.
        await context.grantPermissions(['geolocation']);
        await context.setGeolocation({ latitude: 52.5, longitude: -1.9 });
        await addFreshStorageInitScript(page);
        await page.goto('/');

        // Inject CSS to permanently hide the #help modal.
        // The modal (tw-elements/Bootstrap z-index ~1055) covers the viewport center
        // with pointer-events:auto even when faded out, intercepting all map clicks.
        // Using !important overrides any inline or tw-elements styles.
        await page.addStyleTag({ content: '#help { display: none !important; }' });

        await page.waitForSelector('.toolbar');

        // Wait until Leaflet has set a map view (zoom-N class on #map, added by the
        // zoomend handler after setView() is called from the geolocation callback).
        await page.waitForFunction(() => {
            const mapEl = document.getElementById('map');
            return (
                mapEl !== null &&
                Array.from(mapEl.classList).some((c: string) => c.startsWith('zoom-'))
            );
        });
    });
}

// ===========================================================================
// POINT LAYERS  (click toolbar button → single map click → marker placed)
// ===========================================================================

test.describe('Layer: Modal Filter (point, primary button)', () => {
    setupFreshPage();

    test('toolbar button activates the layer', async ({ page }) => {
        await page.locator('#modal-filter-button').click();
        await expect(page.locator('#modal-filter-button')).toHaveClass(/selected/);
    });

    test('clicking the map places a marker and persists it', async ({ page }) => {
        await page.locator('#modal-filter-button').click();
        await clickMap(page);
        const count = await getLayerFeatureCount(page, 'ModalFilters');
        expect(count).toBe(1);
    });

    test('multiple map clicks place multiple markers', async ({ page }) => {
        await page.locator('#modal-filter-button').click();
        await clickMap(page, -60, 0);
        await clickMap(page, 60, 0);
        await clickMap(page, 0, 60);
        const count = await getLayerFeatureCount(page, 'ModalFilters');
        expect(count).toBe(3);
    });

    test('clicking a placed marker removes it', async ({ page }) => {
        await page.locator('#modal-filter-button').click();
        await clickMap(page);
        expect(await getLayerFeatureCount(page, 'ModalFilters')).toBe(1);

        // Deactivate tool so no new marker is accidentally placed
        await page.locator('#modal-filter-button').click();

        // CircleMarker renders as an SVG path in the custom filters pane.
        // Use dispatchEvent to reliably trigger the Leaflet click handler.
        await page.waitForSelector('.leaflet-filters-pane path');
        await page.locator('.leaflet-filters-pane path').first().dispatchEvent('click');
        await page.waitForTimeout(100);
        expect(await getLayerFeatureCount(page, 'ModalFilters')).toBe(0);
    });

    test('deactivating the button removes selected state', async ({ page }) => {
        const btn = page.locator('#modal-filter-button');
        await btn.click(); // activate
        await btn.click(); // deactivate
        await expect(btn).not.toHaveClass(/selected/);
    });
});

test.describe('Layer: Bus Gate (point, submenu button)', () => {
    setupFreshPage();

    test('right-clicking the filter button reveals the bus gate button', async ({ page }) => {
        // Bus Gate is in the 'filters' subgroup; revealed by right-click on the parent
        await page.locator('#modal-filter-button').dispatchEvent('contextmenu');
        await expect(page.locator('#bus-gate-button')).toBeVisible();
    });

    test('clicking the map places a bus gate marker and persists it', async ({ page }) => {
        await page.locator('#modal-filter-button').dispatchEvent('contextmenu');
        await page.locator('#bus-gate-button').click();
        await clickMap(page);
        const count = await getLayerFeatureCount(page, 'BusGates');
        expect(count).toBe(1);
        // .leaflet-marker-icon scopes the selector to actual map markers only
        // (the legend also uses .bus-gate-icon, so we must be specific)
        await expect(page.locator('.leaflet-marker-icon.bus-gate-icon')).toHaveCount(1);
    });

    test('clicking a placed bus gate marker removes it', async ({ page }) => {
        await page.locator('#modal-filter-button').dispatchEvent('contextmenu');
        await page.locator('#bus-gate-button').click();
        await clickMap(page);
        expect(await getLayerFeatureCount(page, 'BusGates')).toBe(1);

        await page.locator('#bus-gate-button').click(); // deactivate
        await page.waitForSelector('.leaflet-marker-icon.bus-gate-icon');
        await page.locator('.leaflet-marker-icon.bus-gate-icon').first().dispatchEvent('click');
        await page.waitForTimeout(100);
        expect(await getLayerFeatureCount(page, 'BusGates')).toBe(0);
    });
});

test.describe('Layer: Traffic Lights (point, primary button)', () => {
    setupFreshPage();

    test('toolbar button activates the layer', async ({ page }) => {
        await page.locator('#traffic-lights-button').click();
        await expect(page.locator('#traffic-lights-button')).toHaveClass(/selected/);
    });

    test('clicking the map places a traffic light and persists it', async ({ page }) => {
        await page.locator('#traffic-lights-button').click();
        await clickMap(page);
        const count = await getLayerFeatureCount(page, 'TrafficLights');
        expect(count).toBe(1);
        // Use .leaflet-marker-icon to distinguish the map marker from the legend icon
        await expect(page.locator('.leaflet-marker-icon.traffic-lights-icon')).toHaveCount(1);
    });

    test('clicking a placed traffic light removes it', async ({ page }) => {
        await page.locator('#traffic-lights-button').click();
        await clickMap(page);
        await page.locator('#traffic-lights-button').click(); // deactivate
        await page.waitForSelector('.leaflet-marker-icon.traffic-lights-icon');
        await page
            .locator('.leaflet-marker-icon.traffic-lights-icon')
            .first()
            .dispatchEvent('click');
        await page.waitForTimeout(100);
        expect(await getLayerFeatureCount(page, 'TrafficLights')).toBe(0);
    });

    test('deactivating the button removes selected state', async ({ page }) => {
        const btn = page.locator('#traffic-lights-button');
        await btn.click();
        await btn.click();
        await expect(btn).not.toHaveClass(/selected/);
    });
});

test.describe('Layer: Pedestrian Lights (point, submenu button)', () => {
    setupFreshPage();

    test('right-clicking traffic lights button reveals pedestrian lights button', async ({
        page
    }) => {
        await page.locator('#traffic-lights-button').dispatchEvent('contextmenu');
        await expect(page.locator('#pedestrian-lights-button')).toBeVisible();
    });

    test('clicking the map places a pedestrian light and persists it', async ({ page }) => {
        await page.locator('#traffic-lights-button').dispatchEvent('contextmenu');
        await page.locator('#pedestrian-lights-button').click();
        await clickMap(page);
        const count = await getLayerFeatureCount(page, 'PedestrianLights');
        expect(count).toBe(1);
        await expect(page.locator('.leaflet-marker-icon.pedestrian-lights-icon')).toHaveCount(1);
    });
});

test.describe('Layer: Zebra Crossing (point, submenu button)', () => {
    setupFreshPage();

    test('right-clicking traffic lights button reveals zebra crossing button', async ({ page }) => {
        await page.locator('#traffic-lights-button').dispatchEvent('contextmenu');
        await expect(page.locator('#zebra-crossing-button')).toBeVisible();
    });

    test('clicking the map places a zebra crossing and persists it', async ({ page }) => {
        await page.locator('#traffic-lights-button').dispatchEvent('contextmenu');
        await page.locator('#zebra-crossing-button').click();
        await clickMap(page);
        const count = await getLayerFeatureCount(page, 'ZebraCrossing');
        expect(count).toBe(1);
        await expect(page.locator('.leaflet-marker-icon.zebra-crossing-icon')).toHaveCount(1);
    });
});

// ===========================================================================
// POLYLINE LAYERS  (click toolbar button → draw with leaflet.draw)
// ===========================================================================

test.describe('Layer: Mobility Lane (polyline)', () => {
    setupFreshPage();

    test('toolbar button activates the layer', async ({ page }) => {
        await page.locator('#mobility-lane-button').click();
        await expect(page.locator('#mobility-lane-button')).toHaveClass(/selected/);
    });

    test('drawing a polyline creates a mobility lane and persists it', async ({ page }) => {
        await page.locator('#mobility-lane-button').click();
        await drawPolyline(page);
        const count = await getLayerFeatureCount(page, 'MobilityLanes');
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test('deleting a drawn mobility lane removes it from storage', async ({ page }) => {
        await page.locator('#mobility-lane-button').click();
        await drawPolyline(page);
        expect(await getLayerFeatureCount(page, 'MobilityLanes')).toBeGreaterThanOrEqual(1);

        await deleteFirstShape(page);

        expect(await getLayerFeatureCount(page, 'MobilityLanes')).toBe(0);
    });

    test('deactivating the button removes selected state', async ({ page }) => {
        const btn = page.locator('#mobility-lane-button');
        await btn.click();
        await btn.click();
        await expect(btn).not.toHaveClass(/selected/);
    });

    test('active mobility tool shows a selectable cursor on existing mobility lines', async ({
        page
    }) => {
        await page.locator('#mobility-lane-button').click();
        await drawPolyline(page);

        const path = page.locator('.leaflet-overlay-pane path.mobility-lane.leaflet-interactive');
        await hoverSvgPath(page, path);

        const cursor = await getCursorAtPathPoint(path);
        expect(cursor).toBe('pointer');
    });

    test('editing a mobility line falls back to a grab cursor away from features', async ({
        page
    }) => {
        await page.locator('#mobility-lane-button').click();
        await drawPolyline(page);
        await page.locator('#mobility-lane-button').click();

        const path = page.locator('.leaflet-overlay-pane path.mobility-lane.leaflet-interactive');
        await path.first().dispatchEvent('click');
        await page.waitForTimeout(200);

        const point = await moveToMapOffset(page, 0, -140);
        const cursor = await getCursorAtPagePoint(page, point.x, point.y);
        expect(cursor).toBe('grab');
    });

    test('active mobility tool keeps the tool cursor on different layer shapes', async ({
        page
    }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);

        await page.locator('#mobility-lane-button').click();

        const path = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        await hoverLocatorCenter(page, path);

        const cursor = await getCursorAtLocatorCenter(path);
        expect(cursor).toBe('crosshair');
    });
});

test.describe('Layer: Car-Free Street (polyline)', () => {
    setupFreshPage();

    test('toolbar button activates the layer', async ({ page }) => {
        await page.locator('#car-free-street-button').click();
        await expect(page.locator('#car-free-street-button')).toHaveClass(/selected/);
    });

    test('drawing a polyline creates a car-free street and persists it', async ({ page }) => {
        await page.locator('#car-free-street-button').click();
        await drawPolyline(page);
        const count = await getLayerFeatureCount(page, 'CarFreeStreets');
        expect(count).toBeGreaterThanOrEqual(1);
    });
});

test.describe('Layer: School Street (polyline)', () => {
    setupFreshPage();

    test('toolbar button activates the layer', async ({ page }) => {
        await page.locator('#school-street-button').click();
        await expect(page.locator('#school-street-button')).toHaveClass(/selected/);
    });

    test('drawing a polyline creates a school street and persists it', async ({ page }) => {
        await page.locator('#school-street-button').click();
        await drawPolyline(page);
        const count = await getLayerFeatureCount(page, 'SchoolStreet');
        expect(count).toBeGreaterThanOrEqual(1);
    });
});

test.describe('Layer: One-Way Street (polyline)', () => {
    setupFreshPage();

    test('toolbar button activates the layer', async ({ page }) => {
        await page.locator('#one-way-street-button').click();
        await expect(page.locator('#one-way-street-button')).toHaveClass(/selected/);
    });

    test('drawing a polyline creates a one-way street and persists it', async ({ page }) => {
        await page.locator('#one-way-street-button').click();
        await drawPolyline(page);
        const count = await getLayerFeatureCount(page, 'OneWayStreets');
        expect(count).toBeGreaterThanOrEqual(1);
    });
});

test.describe('Layer: Tram Line (polyline)', () => {
    setupFreshPage();

    test('toolbar button activates the layer', async ({ page }) => {
        await page.locator('#tram-line-button').click();
        await expect(page.locator('#tram-line-button')).toHaveClass(/selected/);
    });

    test('drawing a polyline creates a tram line and persists it', async ({ page }) => {
        await page.locator('#tram-line-button').click();
        await drawPolyline(page);
        const count = await getLayerFeatureCount(page, 'TramLines');
        expect(count).toBeGreaterThanOrEqual(1);
    });
});

// ===========================================================================
// POLYGON LAYER  (click toolbar button → draw polygon with leaflet.draw)
// ===========================================================================

test.describe('Layer: LTN Cell (polygon)', () => {
    setupFreshPage();

    test('toolbar button activates the layer', async ({ page }) => {
        await page.locator('#ltn-button').click();
        await expect(page.locator('#ltn-button')).toHaveClass(/selected/);
    });

    test('drawing a polygon creates an LTN cell and persists it', async ({ page }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        const count = await getLayerFeatureCount(page, 'LtnCells');
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test('deleting a drawn LTN cell removes it from storage', async ({ page }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBeGreaterThanOrEqual(1);

        await deleteFirstShape(page);

        expect(await getLayerFeatureCount(page, 'LtnCells')).toBe(0);
    });

    test('deactivating the button removes selected state', async ({ page }) => {
        const btn = page.locator('#ltn-button');
        await btn.click();
        await btn.click();
        await expect(btn).not.toHaveClass(/selected/);
    });

    test('clicking an existing LTN polygon enters edit mode without enabling draw mode', async ({
        page
    }) => {
        // Draw one polygon
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBeGreaterThanOrEqual(1);

        // Deselect the layer so the polygon click starts from a neutral state
        await page.locator('#ltn-button').click();
        await expect(page.locator('#ltn-button')).not.toHaveClass(/selected/);

        // Click the existing polygon — should enter edit mode for the LTN layer
        await page
            .locator(
                '.leaflet-overlay-pane path, .leaflet-polygon-pane path, .leaflet-ltns-pane path'
            )
            .first()
            .dispatchEvent('click');
        await page.waitForTimeout(200);

        // LTN button should now be selected
        await expect(page.locator('#ltn-button')).toHaveClass(/selected/);

        // A map click should NOT create a new LTN cell (edit mode, not draw mode)
        await clickMap(page, 0, -150);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBe(1);
    });

    test('clicking a second LTN polygon deselects the first one', async ({ page }) => {
        // Draw first polygon at map center
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBe(1);

        // Deactivate then reactivate to clearly draw a second polygon
        await page.locator('#ltn-button').click(); // deselect
        await page.locator('#ltn-button').click(); // select for draw

        // Draw second polygon in the top-left quarter to avoid overlapping the first
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('no map box');
        const cx = box.x + box.width / 4;
        const cy = box.y + box.height / 4;
        await page.waitForTimeout(200);
        await page.mouse.click(cx - 40, cy - 25);
        await page.waitForTimeout(200);
        await page.mouse.click(cx + 40, cy - 25);
        await page.waitForTimeout(200);
        await page.mouse.click(cx, cy + 25);
        await page.waitForTimeout(200);
        await page.mouse.dblclick(cx, cy + 40);
        await page.waitForTimeout(500);

        expect(await getLayerFeatureCount(page, 'LtnCells')).toBe(2);

        // Deselect draw mode
        await page.locator('#ltn-button').click();

        // Click the first polygon to enter edit mode — a popup should open
        const polygons = page.locator(
            '.leaflet-overlay-pane path, .leaflet-polygon-pane path, .leaflet-ltns-pane path'
        );
        await polygons.first().dispatchEvent('click');
        await page.waitForTimeout(200);
        await expect(page.locator('#ltn-button')).toHaveClass(/selected/);
        await expect(page.locator('.popup-buttons')).toBeVisible();

        // Click the second polygon — popup should switch to the second polygon
        await polygons.last().dispatchEvent('click');
        await page.waitForTimeout(200);

        // LTN button still selected (edit mode)
        await expect(page.locator('#ltn-button')).toHaveClass(/selected/);

        // Only one popup open at a time
        await expect(page.locator('.popup-buttons')).toHaveCount(1);
    });

    test('editing an LTN polygon uses pointer inside, crosshair on edges, and grab elsewhere', async ({
        page
    }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        await page.locator('#ltn-button').click();

        const polygon = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        await polygon.first().dispatchEvent('click');
        await page.waitForTimeout(200);

        await hoverLocatorCenter(page, polygon);
        expect(await getCursorAtLocatorCenter(polygon)).toBe('pointer');

        await hoverSvgPathStroke(page, polygon);
        expect(await getInlineCursor(polygon)).toBe('crosshair');

        const point = await moveToMapOffset(page, 0, -140);
        expect(await getCursorAtPagePoint(page, point.x, point.y)).toBe('grab');
    });

    test('hovering an existing point feature shows the select cursor even while another tool is active', async ({
        page
    }) => {
        await page.locator('#modal-filter-button').click({ button: 'right' });
        await page.locator('#bus-gate-button').click();
        await clickMap(page);

        await page.locator('#mobility-lane-button').click();

        const marker = page.locator('.leaflet-marker-icon.bus-gate-icon');
        await hoverLocatorCenter(page, marker);

        const cursor = await getCursorAtLocatorCenter(marker);
        expect(cursor).toContain('data:image/svg+xml');
        expect(cursor).toContain('M20,6V5a3,3,0,0,0-3-3H15a3,3,0,0,0-3,3V6H4V8H6V27');
    });
});

// ===========================================================================
// CROSS-LAYER: only one layer can be active at a time
// ===========================================================================

test.describe('Layer exclusivity', () => {
    setupFreshPage();

    test('activating a second layer deactivates the first', async ({ page }) => {
        await page.locator('#modal-filter-button').click();
        await expect(page.locator('#modal-filter-button')).toHaveClass(/selected/);

        await page.locator('#traffic-lights-button').click();
        await expect(page.locator('#traffic-lights-button')).toHaveClass(/selected/);
        await expect(page.locator('#modal-filter-button')).not.toHaveClass(/selected/);
    });

    test('features from different layers are stored independently', async ({ page }) => {
        // Place a modal filter
        await page.locator('#modal-filter-button').click();
        await clickMap(page, -80, 0);

        // Place a traffic light
        await page.locator('#traffic-lights-button').click();
        await clickMap(page, 80, 0);

        expect(await getLayerFeatureCount(page, 'ModalFilters')).toBe(1);
        expect(await getLayerFeatureCount(page, 'TrafficLights')).toBe(1);
    });

    test('clicking on an existing polyline keeps an active point layer selected and places the point', async ({
        page
    }) => {
        // Create one mobility lane to edit later.
        await page.locator('#mobility-lane-button').click();
        await drawPolyline(page);
        expect(await getLayerFeatureCount(page, 'MobilityLanes')).toBeGreaterThanOrEqual(1);

        // Switch to a point layer.
        await page.locator('#modal-filter-button').click();
        await expect(page.locator('#modal-filter-button')).toHaveClass(/selected/);

        await clickMap(page, 0, 0);

        await expect(page.locator('#modal-filter-button')).toHaveClass(/selected/);
        await expect(page.locator('#mobility-lane-button')).not.toHaveClass(/selected/);

        expect(await getLayerFeatureCount(page, 'ModalFilters')).toBe(1);
        expect(await getLayerFeatureCount(page, 'MobilityLanes')).toBeGreaterThanOrEqual(1);
    });

    test('clicking inside an existing LTN cell keeps an active point layer selected and places the point', async ({
        page
    }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBe(1);

        await page.locator('#modal-filter-button').click();
        await expect(page.locator('#modal-filter-button')).toHaveClass(/selected/);

        await clickMap(page, 0, 0);

        await expect(page.locator('#modal-filter-button')).toHaveClass(/selected/);
        await expect(page.locator('#ltn-button')).not.toHaveClass(/selected/);
        expect(await getLayerFeatureCount(page, 'ModalFilters')).toBe(1);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBe(1);
    });
});
