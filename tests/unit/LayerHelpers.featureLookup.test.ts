/**
 * Unit tests for layer helpers — feature group lookups and history ids.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import {
    buildHistoryId,
    getFeatureHistoryId,
    findLayerFeatureByHistoryId
} from '../../src/composables/layers/features/featureLookup';
import {
    cacheFeatureGroupElement,
    findFeatureGroupIdByElement,
    findFirstFeatureGroupId
} from '../../src/composables/layers/features/featureGroupMembershipPopup';
import { useGroupStore } from '../../src/stores/groupStore';
import { pinia } from '../../src/stores';
import { useSelectionStore } from '../../src/stores/selectionStore';

beforeEach(() => {
    document.getElementById('map')?.remove();
    document.querySelector('.leaflet-mouse-marker')?.remove();
    vi.clearAllMocks();
    useGroupStore(pinia).setGroups([]);
    useSelectionStore(pinia).deactivate();
});

describe('feature group lookups', () => {
    it('finds the first group containing a feature', () => {
        const member = { layerId: 'ModalFilters', historyId: 'filter-1' };
        useGroupStore(pinia).setGroups([{ id: 'g1', name: 'Centre', members: [member] }]);

        expect(findFirstFeatureGroupId(member)).toBe('g1');
        expect(findFirstFeatureGroupId({ layerId: 'ModalFilters', historyId: 'other' })).toBeNull();
    });

    it('caches group ids per element, including a cleared membership', () => {
        const element = document.createElement('div');
        const other = document.createElement('div');

        cacheFeatureGroupElement(element, 'g1');
        expect(findFeatureGroupIdByElement(element)).toBe('g1');
        expect(findFeatureGroupIdByElement(other)).toBeNull();

        cacheFeatureGroupElement(element, null);
        expect(findFeatureGroupIdByElement(element)).toBeNull();
    });
});

describe('buildHistoryId', () => {
    it('uses crypto.randomUUID when available', () => {
        const originalRandomUuid = crypto.randomUUID;
        Object.defineProperty(crypto, 'randomUUID', {
            value: () => 'generated-uuid',
            configurable: true
        });

        try {
            expect(buildHistoryId('point')).toBe('generated-uuid');
        } finally {
            Object.defineProperty(crypto, 'randomUUID', {
                value: originalRandomUuid,
                configurable: true
            });
        }
    });

    it('includes the requested prefix when crypto.randomUUID is unavailable', () => {
        const originalRandomUuid = crypto.randomUUID;
        Object.defineProperty(crypto, 'randomUUID', {
            value: undefined,
            configurable: true
        });

        try {
            expect(buildHistoryId('point')).toMatch(/^point-/);
        } finally {
            Object.defineProperty(crypto, 'randomUUID', {
                value: originalRandomUuid,
                configurable: true
            });
        }
    });
});

describe('getFeatureHistoryId', () => {
    it('reads the id from feature.properties.historyId (points, polylines)', () => {
        const marker = { feature: { properties: { historyId: 'abc-123' } } };
        expect(getFeatureHistoryId(marker)).toBe('abc-123');
    });

    it('falls back to properties.historyId (LTN polygons)', () => {
        const polygon = { properties: { historyId: 'ltn-456' } };
        expect(getFeatureHistoryId(polygon)).toBe('ltn-456');
    });

    it('prefers feature.properties.historyId when both are present', () => {
        const marker = {
            feature: { properties: { historyId: 'from-feature' } },
            properties: { historyId: 'from-properties' }
        };
        expect(getFeatureHistoryId(marker)).toBe('from-feature');
    });

    it('returns null when no id is present', () => {
        expect(getFeatureHistoryId({})).toBeNull();
        expect(getFeatureHistoryId(null)).toBeNull();
        expect(getFeatureHistoryId({ feature: { properties: {} } })).toBeNull();
        expect(getFeatureHistoryId({ properties: { historyId: '' } })).toBeNull();
    });
});

describe('findLayerFeatureByHistoryId', () => {
    it('finds a polygon by its properties id in the requested layer', () => {
        const target = { properties: { historyId: 'ltn-1' } };
        const other = { feature: { properties: { historyId: 'point-1' } } };
        const layers = [
            {
                id: 'Points',
                getLayer: () => ({ eachLayer: (visit: (item: any) => void) => visit(other) })
            },
            {
                id: 'LtnCells',
                getLayer: () => ({ eachLayer: (visit: (item: any) => void) => visit(target) })
            }
        ] as any;

        expect(findLayerFeatureByHistoryId(layers, 'LtnCells', 'ltn-1')).toBe(target);
        expect(findLayerFeatureByHistoryId(layers, 'Points', 'ltn-1')).toBeNull();
        expect(findLayerFeatureByHistoryId(layers, 'missing', 'ltn-1')).toBeNull();
    });
});
