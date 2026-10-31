/**
 * Unit tests for layer helpers — map/feature cursors and feature classification.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import {
    setMapCursor,
    removeMapCursor,
    setFeatureElementCursor,
    setMouseMarkerCursor
} from '../../src/composables/layers/features/featureCursors';
import {
    isPointFeatureElement,
    isFeatureEditLayerButtonId
} from '../../src/composables/layers/features/featureClassification';
import { useGroupStore } from '../../src/stores/groupStore';
import { pinia } from '../../src/stores';
import { useSelectionStore } from '../../src/stores/selectionStore';
import { makeMapEl, getMapEl, makeMouseMarkerEl } from './LayerHelpers.helpers';

beforeEach(() => {
    document.getElementById('map')?.remove();
    document.querySelector('.leaflet-mouse-marker')?.remove();
    vi.clearAllMocks();
    useGroupStore(pinia).setGroups([]);
    useSelectionStore(pinia).deactivate();
});

describe('setMapCursor', () => {
    it('removes leaflet-grab and adds the given class', () => {
        makeMapEl();
        setMapCursor('modal-filter');
        expect(getMapEl().classList.contains('leaflet-grab')).toBe(false);
        expect(getMapEl().classList.contains('modal-filter')).toBe(true);
    });

    it('is a no-op when the map element does not exist', () => {
        expect(() => setMapCursor('modal-filter')).not.toThrow();
    });
});

describe('removeMapCursor', () => {
    it('removes the given class and restores leaflet-grab', () => {
        const el = makeMapEl();
        el.classList.remove('leaflet-grab');
        el.classList.add('modal-filter');
        removeMapCursor('modal-filter');
        expect(getMapEl().classList.contains('modal-filter')).toBe(false);
        expect(getMapEl().classList.contains('leaflet-grab')).toBe(true);
    });

    it('is a no-op when the map element does not exist', () => {
        expect(() => removeMapCursor('modal-filter')).not.toThrow();
    });
});

describe('setFeatureElementCursor', () => {
    it('sets and clears the cursor on a marker icon and its children', () => {
        const icon = document.createElement('div');
        const child = document.createElement('span');
        icon.appendChild(child);

        setFeatureElementCursor({ _icon: icon }, 'pointer');
        expect(icon.style.getPropertyValue('cursor')).toBe('pointer');
        expect(child.style.getPropertyPriority('cursor')).toBe('important');

        setFeatureElementCursor({ _icon: icon }, null);
        expect(icon.style.getPropertyValue('cursor')).toBe('');
        expect(child.style.getPropertyValue('cursor')).toBe('');
    });
});

describe('isPointFeatureElement', () => {
    it('returns true for known point feature classes', () => {
        const el = document.createElement('div');
        el.classList.add('traffic-lights-icon');

        expect(isPointFeatureElement(el)).toBe(true);
    });

    it('returns false for unrelated elements', () => {
        const el = document.createElement('div');
        el.classList.add('leaflet-interactive');

        expect(isPointFeatureElement(el)).toBe(false);
    });
});

describe('isFeatureEditLayerButtonId', () => {
    it('recognizes editable layers but not point tools or null', () => {
        expect(isFeatureEditLayerButtonId('mobility-lane')).toBe(true);
        expect(isFeatureEditLayerButtonId('ltn')).toBe(true);
        expect(isFeatureEditLayerButtonId('modal-filter')).toBe(false);
        expect(isFeatureEditLayerButtonId(null)).toBe(false);
    });
});

describe('setMouseMarkerCursor', () => {
    it('sets the cursor on the leaflet mouse marker', () => {
        const marker = makeMouseMarkerEl();

        setMouseMarkerCursor('crosshair');

        expect(marker.style.cursor).toBe('crosshair');
    });

    it('removes the cursor when null is passed', () => {
        const marker = makeMouseMarkerEl();
        marker.style.cursor = 'pointer';

        setMouseMarkerCursor(null);

        expect(marker.style.cursor).toBe('');
    });

    it('is a no-op when the mouse marker element does not exist', () => {
        expect(() => setMouseMarkerCursor('grab')).not.toThrow();
    });
});
