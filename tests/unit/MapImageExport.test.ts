import { describe, expect, it, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import {
    buildImageExportFilename,
    getImageExportValidationError,
    MAX_IMAGE_EXPORT_PIXELS
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
});
