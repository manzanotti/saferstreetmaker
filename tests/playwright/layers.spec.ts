import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read the decompressed feature count for a layer from localStorage. */
async function getLayerFeatureCount(page: Page, layerId: string): Promise<number> {
  return page.evaluate((id) => {
    const raw = window.localStorage.getItem('Map_Hello Cleveland');
    if (!raw) return 0;
    const decompressed = (window as any).LZString.decompress(raw);
    if (!decompressed) return 0;
    const mapData = JSON.parse(decompressed);
    return mapData?.layers?.[id]?.features?.length ?? 0;
  }, layerId);
}

/** Click at a position relative to the centre of the Leaflet map. */
async function clickMap(page: Page, offsetX = 0, offsetY = 0) {
  const map = page.locator('.leaflet-container');
  const box = await map.boundingBox();
  if (!box) throw new Error('Map bounding box not found');
  await page.mouse.click(
    box.x + box.width / 2 + offsetX,
    box.y + box.height / 2 + offsetY
  );
  // PubSub.js dispatches subscribers asynchronously (via setTimeout(fn,0)).
  // Wait for the mapClicked subscribers (addMarker → layerUpdated → saveMap) to run.
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
  await page.waitForTimeout(200); // let button-click PubSub (refreshToolbar) settle
  await page.mouse.click(cx - 60, cy);
  await page.waitForTimeout(200);
  await page.mouse.click(cx + 60, cy);
  await page.waitForTimeout(200);
  await page.mouse.dblclick(cx + 60, cy + 60);
  await page.waitForTimeout(500); // two-level PubSub async chain (drawCreated → layerUpdated → saveMap)
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
  await page.mouse.click(cx,      cy + 40);
  await page.waitForTimeout(200);
  await page.mouse.dblclick(cx, cy + 60);
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// Shared beforeEach – clear storage so each test starts from a blank map
// ---------------------------------------------------------------------------

function setupFreshPage() {
  test.beforeEach(async ({ page, context }) => {
    // Provide a fixed geolocation so the map view is set during page load.
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 52.5, longitude: -1.9 });
    await page.addInitScript(() => window.localStorage.clear());
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
      return mapEl !== null &&
        Array.from(mapEl.classList).some((c: string) => c.startsWith('zoom-'));
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
    await page.locator('.leaflet-marker-icon.traffic-lights-icon').first().dispatchEvent('click');
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

  test('right-clicking traffic lights button reveals pedestrian lights button', async ({ page }) => {
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

  test('deactivating the button removes selected state', async ({ page }) => {
    const btn = page.locator('#mobility-lane-button');
    await btn.click();
    await btn.click();
    await expect(btn).not.toHaveClass(/selected/);
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

  test('deactivating the button removes selected state', async ({ page }) => {
    const btn = page.locator('#ltn-button');
    await btn.click();
    await btn.click();
    await expect(btn).not.toHaveClass(/selected/);
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
});
