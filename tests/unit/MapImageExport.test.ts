import { describe, expect, it, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import {
    buildImageExportFilename,
    getImageExportValidationError,
    MAX_IMAGE_EXPORT_PIXELS,
    waitForExportFrame
} from '../../src/features/export/mapImageExport';

describe('map image export inputs', () => {
    it('requires finite whole-number dimensions', () => {
        expect(getImageExportValidationError(null, 500)).toContain('Enter a width');
        expect(getImageExportValidationError(Number.NaN, 500)).toContain('Enter a width');
        expect(getImageExportValidationError(400.5, 500)).toContain('whole numbers');
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
