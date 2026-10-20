import { describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import {
    buildImageExportFilename,
    getImageExportValidationError,
    MAX_IMAGE_EXPORT_PIXELS,
    waitForExportFrame,
    settleMapViewForExport
} from '../../src/features/export/mapImageExport';

describe('map image export inputs', () => {
    it('requires finite whole-number dimensions', () => {
        expect(getImageExportValidationError(null, 500)).toContain('Enter a width');
        expect(getImageExportValidationError(Number.NaN, 500)).toContain('Enter a width');
        expect(getImageExportValidationError(400.5, 500)).toContain('whole numbers');
    });

    describe('settling the map before image export', () => {
        async function withExportFrames(
            run: (map: L.Map, stop: ReturnType<typeof vi.fn>) => Promise<void>
        ) {
            vi.useFakeTimers();
            vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
                window.setTimeout(() => callback(performance.now()), 16)
            );
            vi.stubGlobal('cancelAnimationFrame', window.clearTimeout);
            const map = new L.Map(document.createElement('div'));
            const stop = vi.fn(() => map);
            Object.assign(map, { stop });
            try {
                await run(map, stop);
            } finally {
                vi.useRealTimers();
                vi.unstubAllGlobals();
            }
        }

        it('stops panning once a settled view is ready', async () => {
            await withExportFrames(async (map, stop) => {
                const settling = settleMapViewForExport(map);
                await vi.runAllTimersAsync();
                await settling;
                expect(stop).toHaveBeenCalledOnce();
            });
        });

        it('waits for zooms queued on the next frame before stopping the map', async () => {
            await withExportFrames(async (map, stop) => {
                const pane = document.createElement('div');
                map.getContainer().append(pane);
                window.requestAnimationFrame(() => pane.classList.add('leaflet-zoom-anim'));
                const settling = settleMapViewForExport(map);
                await vi.advanceTimersByTimeAsync(100);
                expect(stop).not.toHaveBeenCalled();
                pane.classList.remove('leaflet-zoom-anim');
                await vi.runAllTimersAsync();
                await settling;
                expect(stop).toHaveBeenCalledOnce();
            });
        });

        it('reports a zoom that never settles instead of capturing misplaced features', async () => {
            await withExportFrames(async (map, stop) => {
                const pane = document.createElement('div');
                pane.classList.add('leaflet-zoom-anim');
                map.getContainer().append(pane);
                const failed = expect(settleMapViewForExport(map)).rejects.toThrow(
                    'map is still zooming'
                );
                await vi.runAllTimersAsync();
                await failed;
                expect(stop).not.toHaveBeenCalled();
            });
        });
    });

    it('enforces individual dimension and total pixel limits', () => {
        expect(getImageExportValidationError(255, 500)).toContain('between 256 and 8192');
        expect(getImageExportValidationError(8193, 500)).toContain('between 256 and 8192');
        expect(getImageExportValidationError(8192, 2048)).toBeNull();
        expect(getImageExportValidationError(8192, 2049)).toContain('image is too large');
        expect(MAX_IMAGE_EXPORT_PIXELS).toBe(16_777_216);
    });

    it('creates a safe PNG filename and falls back when the title is empty', () => {
        expect(buildImageExportFilename('City / Central')).toBe('City - Central.png');
        expect(buildImageExportFilename('...')).toBe('map.png');
    });

    it('does not wait for animation frames while the document is already hidden', async () => {
        const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: 'hidden'
        });
        const requestFrame = vi.fn(() => 1);
        vi.stubGlobal('requestAnimationFrame', requestFrame);

        try {
            await waitForExportFrame();
            expect(requestFrame).not.toHaveBeenCalled();
        } finally {
            vi.unstubAllGlobals();
            if (visibility) {
                Object.defineProperty(document, 'visibilityState', visibility);
            } else {
                delete (document as Partial<Document>).visibilityState;
            }
        }
    });

    it('settles when the document becomes hidden before the next animation frame', async () => {
        const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
        const cancelFrame = vi.fn();
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: 'visible'
        });
        vi.stubGlobal(
            'requestAnimationFrame',
            vi.fn(() => 7)
        );
        vi.stubGlobal('cancelAnimationFrame', cancelFrame);

        try {
            const waiting = waitForExportFrame();
            Object.defineProperty(document, 'visibilityState', {
                configurable: true,
                value: 'hidden'
            });
            document.dispatchEvent(new Event('visibilitychange'));
            await expect(waiting).resolves.toBeUndefined();
            expect(cancelFrame).toHaveBeenCalledWith(7);
        } finally {
            vi.unstubAllGlobals();
            if (visibility) {
                Object.defineProperty(document, 'visibilityState', visibility);
            } else {
                delete (document as Partial<Document>).visibilityState;
            }
        }
    });
});
