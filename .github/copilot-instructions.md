# Safer Street Maker — Copilot Instructions

## Project Overview
- **Name**: Safer Street Maker
- **Type**: Single-page web application

## Tech Stack
- **HTML**: Single page (`src/index.html`)
- **TypeScript**: All logic/interactivity (`src/scripts/`)
- **Leaflet.js**: Map management and rendering
- **Tailwind CSS**: Styling
- **PubSub.js**: Event bus used for all inter-component communication (layer selection, map clicks, show/hide modals, save/load, etc.)

## PubSub.js Notes
- All `PubSub.publish()` calls are **asynchronous** — subscribers fire via `setTimeout(fn, 0)`, so side-effects (e.g. `addMarker`, `saveMap`) do not happen synchronously after a `publish()` call.
- In Playwright tests, always add `await page.waitForTimeout(100)` (or longer for multi-hop chains like `drawCreated → layerUpdated → saveMap`) after triggering any action that internally uses PubSub.
- Event topic names are defined in `src/scripts/EventTopics.ts`.

## Project Structure
- `src/index.html` — main (and only) HTML page
- `src/scripts/` — TypeScript source files
- `src/styles/` — CSS files
- `src/scripts/layers/` — Leaflet map layer implementations (11 layers)
- `src/scripts/Controls/` — UI controls (Toolbar, Legend, Settings, MapManager, Sharing, Help)

## Build & Dev
- **Bundler**: Parcel (`yarn start` → dev server on `http://localhost:1234`, `yarn build` → production)
- **Package manager**: Yarn (v3 - Berry)
- **Tests**: `yarn test` (Playwright, config in `playwright.config.ts`, test files in `tests/`)

## Map Layers
Eleven layers, each in `src/scripts/layers/`. Two interaction patterns:
- **Point layers** (click map to place a marker): ModalFilter, BusGate, TrafficLights, PedestrianLights, ZebraCrossing
- **Polyline/Polygon layers** (leaflet.draw): MobilityLane, CarFreeStreet, SchoolStreet, OneWayStreet, TramLine (polylines), LtnCell (polygon)

BusGate, and TrafficLights/PedestrianLights/ZebraCrossing are grouped in toolbar submenus — revealed by right-clicking the parent toolbar button.

Map data is saved to `localStorage` as LZ-string compressed JSON, key `Map_<title>`.

## Playwright Testing Notes
- **Dev server**: Playwright config auto-starts `yarn start` (Parcel) on port 1234.
- **#help modal blocks map clicks**: The tw-elements/Bootstrap help modal (z-index ~1055) covers the viewport even when faded, intercepting clicks. In `beforeEach`, inject: `await page.addStyleTag({ content: '#help { display: none !important; }' })`.
- **Map view timing**: Leaflet's `setView()` is called from the geolocation success callback (async). Wait for it with `context.grantPermissions(['geolocation'])` + `context.setGeolocation(...)` + `page.waitForFunction(() => Array.from(document.getElementById('map')?.classList ?? []).some(c => c.startsWith('zoom-')))`.
- **leaflet.draw needs click delays**: Rapid back-to-back `page.mouse.click` calls confuse leaflet.draw's state machine and prevent `draw:created` from firing. Add `await page.waitForTimeout(200)` between each click when drawing polylines/polygons.
- **Legend shares icon CSS classes**: e.g. `.traffic-lights-icon` matches both the legend `<li>` and the map `DivIcon` marker. Always scope to `.leaflet-marker-icon.traffic-lights-icon` when targeting map markers.
- **Deleting markers**: Use `dispatchEvent('click')` rather than `.click()` on DivIcon markers and SVG paths — Playwright's actionability checks can fail on these elements.
