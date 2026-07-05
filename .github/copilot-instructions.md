# Safer Street Maker — Copilot Instructions

## Project Overview

- **Name**: Safer Street Maker
- **Type**: Single-page web application

## Tech Stack

- **HTML**: Single page (`src/index.html`)
- **Vue 3**: UI layer — Composition API with `<script setup lang="ts">` throughout (`src/components/`, `src/composables/`)
- **Pinia**: State management (`src/stores/`) — `mapStore`, `settingsStore`, `uiStore`
- **TypeScript**: All logic (`src/composables/`, `src/services/`, `src/models/`)
- **Leaflet.js**: Map management and rendering
- **Tailwind CSS**: Styling

## Architecture

- UI controls (Toolbar, Legend, modal container) are Vue components mounted into Leaflet `L.Control` containers via `makeLeafletVueControl()` in `src/composables/useLeafletVueControl.ts`. All share a single Pinia instance so stores are reactive across controls.
- Layer state and selection is managed via `mapStore.activeLayerId` (a `ref<string | null>`). Layer composables use `watch({ flush: 'sync' })` on this value to attach/detach Leaflet event listeners and Leaflet.draw tools synchronously.
- Map data persistence is handled by `src/services/FileManager.ts`, which delegates to `MapSerializer` (JSON ↔ LZ-string) and `MapStorage` (localStorage CRUD).
- There is **no event bus** — PubSub.js was removed. Cross-layer communication uses Pinia store mutations and direct Leaflet event listeners.

## Project Structure

- `src/index.html` — main (and only) HTML page
- `src/main.ts` — app bootstrap (Vue mount + Leaflet init + layer setup)
- `src/App.vue` — Vue root (mounts `HelpModal` and `ErrorModal`)
- `src/components/` — Vue components (controls and modals)
- `src/composables/` — composable factories and layer implementations
- `src/composables/layers/` — one composable per layer + shared helpers
- `src/stores/` — Pinia stores
- `src/services/` — `FileManager`, `MapSerializer`, `MapStorage`
- `src/models/` — plain TS types: `Settings`, `ToolbarButton`
- `src/styles/` — CSS files

## Build & Dev

- **Bundler/dev server**: Vite (`yarn start` → dev server on `http://localhost:1234`, `yarn build` → production, `yarn preview` → preview build)
- **Docs and skills workflow**:
    - Use the Context7 MCP to query official documentation whenever external library or framework guidance is needed.
    - Check any locally installed skills before starting a task to see whether they provide relevant guidance or reusable patterns.
- **Package manager**: Yarn (v3 - Berry)
- **After completing code changes**: Run `yarn format` once before the rest of the validation steps so any Prettier fixes are applied before typechecking, building, or testing.
- **Validation order before completion**:
    1. Run `yarn format` to auto-fix any Prettier formatting issues.
    2. Run `yarn typecheck` for TypeScript validation.
    3. Run `yarn build` for HTML/build validation and to confirm the app still compiles cleanly.
    4. Run `yarn test:unit` for the Vitest suite.
    5. Run `yarn test` for the Playwright suite.
- **Do not mark a task complete until all five checks above have been run successfully.**
- **Tests**: `yarn test` (Playwright, config in `tests/playwright.config.ts`, test files in `tests/playwright/`), plus `yarn test:unit` for Vitest (config in `tests/vitest.config.ts`, tests in `tests/unit/`)

## Testing Policy

- **Always add tests for new work.** Every new feature and every bug fix must be accompanied by appropriate tests. Use Vitest unit tests for logic, composables, stores, and helpers; use Playwright E2E tests for user-visible behaviour (clicks, keyboard shortcuts, map interactions, persistence). If both apply, add both.
- **Never modify production source code solely to support tests.** If a test needs access to internal state, use existing public APIs, DOM structure, or framework hooks (e.g. accessing Pinia stores via the mounted Vue app's `$pinia` on `document.getElementById('app').__vue_app__.config.globalProperties.$pinia`). Test helpers belong in test files, not in `src/`.

## Coding Style

- **Always use braces for control-flow statements.** `if`, `else`, `for`, `while`, and `do` bodies must always be wrapped in `{ }`, even when the body is a single statement. Never write inline/braceless forms such as `if (x) return;`.

## Map Layers

Eleven layers, each in `src/composables/layers/`. Two interaction patterns:

- **Point layers** (click map to place a marker): ModalFilter, BusGate, TrafficLights, PedestrianLights, ZebraCrossing
- **Polyline/Polygon layers** (leaflet.draw): MobilityLane, CarFreeStreet, SchoolStreet, OneWayStreet, TramLine (polylines), LtnCell (polygon)

BusGate, and TrafficLights/PedestrianLights/ZebraCrossing are grouped in toolbar submenus — revealed by right-clicking the parent toolbar button.

Map data is saved to `localStorage` as LZ-string compressed JSON, key `Map_<title>`.

## Playwright Testing Notes

- **Dev server**: Playwright config auto-starts `yarn start` (Vite) on port 1234.
- **#help modal blocks map clicks**: The help modal sits above the map and can intercept clicks when visible. In `beforeEach`, inject: `await page.addStyleTag({ content: '#help { display: none !important; }' })` when the test only needs the map surface.
- **Map view timing**: Leaflet's `setView()` is called from the geolocation success callback (async). Wait for it with `context.grantPermissions(['geolocation'])` + `context.setGeolocation(...)` + `page.waitForFunction(() => Array.from(document.getElementById('map')?.classList ?? []).some(c => c.startsWith('zoom-')))`.
- **leaflet.draw needs click delays**: Rapid back-to-back `page.mouse.click` calls confuse leaflet.draw's state machine and prevent `draw:created` from firing. Add `await page.waitForTimeout(200)` between each click when drawing polylines/polygons.
- **Add `waitForTimeout` after map interactions**: Layer composables call `mapStore.markLayerUpdated()` synchronously, but the debounced save runs asynchronously. Add `await page.waitForTimeout(100)` after placing a marker, or `await page.waitForTimeout(500)` after drawing a polyline/polygon, before reading localStorage.
- **Legend shares icon CSS classes**: e.g. `.traffic-lights-icon` matches both the legend `<li>` and the map `DivIcon` marker. Always scope to `.leaflet-marker-icon.traffic-lights-icon` when targeting map markers.
- **Deleting markers**: Use `dispatchEvent('click')` rather than `.click()` on DivIcon markers and SVG paths — Playwright's actionability checks can fail on these elements.
