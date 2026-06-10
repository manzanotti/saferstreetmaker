import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));
vi.mock('pubsub-js', () => ({
    default: { subscribe: vi.fn(), publish: vi.fn() },
}));

import PubSub from 'pubsub-js';
import {
    setMapCursor,
    removeMapCursor,
    selectLayer,
    deselectPointLayer,
    deselectPolylineLayer,
    buildToolbarButton,
    buildLegendEntry,
    subscribePointLayerEvents,
    subscribePolylineLayerEvents,
} from '../../src/scripts/layers/LayerHelpers';
import { EventTopics } from '../../src/scripts/EventTopics';

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function makeMapEl() {
    const el = document.createElement('div');
    el.id = 'map';
    el.classList.add('leaflet-grab');
    document.body.appendChild(el);
    return el;
}

function getMapEl() {
    return document.getElementById('map')!;
}

beforeEach(() => {
    // Reset the #map element before each test
    document.getElementById('map')?.remove();
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// setMapCursor / removeMapCursor
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// selectLayer / deselectPointLayer
// ---------------------------------------------------------------------------

describe('selectLayer', () => {
    it('sets state.selected to true', () => {
        makeMapEl();
        const state = { selected: false };
        selectLayer(state, 'modal-filter');
        expect(state.selected).toBe(true);
    });

    it('calls setMapCursor with the correct css class', () => {
        const el = makeMapEl();
        selectLayer({ selected: false }, 'bus-gate');
        expect(el.classList.contains('bus-gate')).toBe(true);
    });
});

describe('deselectPointLayer', () => {
    it('sets state.selected to false and restores cursor', () => {
        const el = makeMapEl();
        el.classList.add('modal-filter');
        el.classList.remove('leaflet-grab');
        const state = { selected: true };
        deselectPointLayer(state, 'modal-filter');
        expect(state.selected).toBe(false);
        expect(el.classList.contains('leaflet-grab')).toBe(true);
    });

    it('is a no-op when state.selected is already false', () => {
        makeMapEl();
        const state = { selected: false };
        deselectPointLayer(state, 'modal-filter');
        expect(state.selected).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// deselectPolylineLayer
// ---------------------------------------------------------------------------

describe('deselectPolylineLayer', () => {
    it('is a no-op when state.selected is false', () => {
        makeMapEl();
        const state = { selected: false };
        const layer = { eachLayer: vi.fn() };
        deselectPolylineLayer(state as any, 'car-free-street', layer as any);
        expect(layer.eachLayer).not.toHaveBeenCalled();
    });

    it('disables editing on each sub-layer', () => {
        makeMapEl();
        const disableSpy = vi.fn();
        const layer = {
            eachLayer: (fn: (l: any) => void) => fn({ editing: { disable: disableSpy } }),
        };
        const state = { selected: true };
        deselectPolylineLayer(state as any, 'car-free-street', layer as any);
        expect(disableSpy).toHaveBeenCalledOnce();
    });

    it('calls disable on the drawing tool if provided', () => {
        makeMapEl();
        const drawDisable = vi.fn();
        const layer = { eachLayer: vi.fn() };
        const state = { selected: true };
        deselectPolylineLayer(state as any, 'mobility-lane', layer as any, { disable: drawDisable });
        expect(drawDisable).toHaveBeenCalledOnce();
    });

    it('handles null drawing tool without throwing', () => {
        makeMapEl();
        const layer = { eachLayer: vi.fn() };
        const state = { selected: true };
        expect(() => deselectPolylineLayer(state as any, 'ltn-cell', layer as any, null)).not.toThrow();
    });

    it('sets state.selected to false', () => {
        makeMapEl();
        const state = { selected: true };
        const layer = { eachLayer: vi.fn() };
        deselectPolylineLayer(state as any, 'school-street', layer as any);
        expect(state.selected).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// buildToolbarButton
// ---------------------------------------------------------------------------

describe('buildToolbarButton', () => {
    const noop = () => {};

    it('sets all required properties', () => {
        const btn = buildToolbarButton({
            id: 'modal-filter',
            tooltip: 'Add modal filters',
            groupName: 'filters',
            action: noop,
            selected: false,
        });
        expect(btn.id).toBe('modal-filter');
        expect(btn.tooltip).toBe('Add modal filters');
        expect(btn.groupName).toBe('filters');
        expect(btn.action).toBe(noop);
        expect(btn.selected).toBe(false);
    });

    it('sets isFirst when provided', () => {
        const btn = buildToolbarButton({
            id: 'x', tooltip: 'x', groupName: '', action: noop, selected: false, isFirst: true,
        });
        expect(btn.isFirst).toBe(true);
    });

    it('sets text when provided', () => {
        const btn = buildToolbarButton({
            id: 'ltn', tooltip: 'LTN', groupName: '', action: noop, selected: false, text: 'LTN',
        });
        expect(btn.text).toBe('LTN');
    });

    it('does not set isFirst when not provided', () => {
        const btn = buildToolbarButton({
            id: 'x', tooltip: 'x', groupName: '', action: noop, selected: false,
        });
        expect(btn.isFirst).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// buildLegendEntry
// ---------------------------------------------------------------------------

describe('buildLegendEntry', () => {
    it('creates an li with the correct id', () => {
        const icon = document.createElement('i');
        const li = buildLegendEntry({
            layerId: 'ModalFilters',
            title: 'Modal Filters',
            toggleTitle: 'Toggle',
            iconEl: icon,
            visibilityState: { visible: false },
        });
        expect(li.id).toBe('ModalFilters-legend');
    });

    it('contains the title text', () => {
        const icon = document.createElement('i');
        const li = buildLegendEntry({
            layerId: 'BusGates',
            title: 'Bus Gates',
            toggleTitle: 'Toggle',
            iconEl: icon,
            visibilityState: { visible: false },
        });
        expect(li.textContent).toContain('Bus Gates');
    });

    it('click toggles visible=true and publishes showLayer', () => {
        const state = { visible: false };
        const icon = document.createElement('i');
        const li = buildLegendEntry({
            layerId: 'ModalFilters', title: 'MF', toggleTitle: 'T', iconEl: icon, visibilityState: state,
        });
        li.click();
        expect(state.visible).toBe(true);
        expect(PubSub.publish).toHaveBeenCalledWith(EventTopics.showLayer, 'ModalFilters');
    });

    it('click toggles visible=false and publishes hideLayer on second click', () => {
        const state = { visible: true };
        const icon = document.createElement('i');
        const li = buildLegendEntry({
            layerId: 'ModalFilters', title: 'MF', toggleTitle: 'T', iconEl: icon, visibilityState: state,
        });
        li.click();
        expect(state.visible).toBe(false);
        expect(PubSub.publish).toHaveBeenCalledWith(EventTopics.hideLayer, 'ModalFilters');
    });
});

// ---------------------------------------------------------------------------
// subscribePointLayerEvents
// ---------------------------------------------------------------------------

describe('subscribePointLayerEvents', () => {
    it('registers three PubSub subscribers', () => {
        const state = { selected: false };
        subscribePointLayerEvents('TestLayer', state, 'test-cursor', vi.fn());
        expect(PubSub.subscribe).toHaveBeenCalledTimes(3);
    });

    it('subscriber topics are layerSelected, layerDeselected, mapClicked', () => {
        const state = { selected: false };
        subscribePointLayerEvents('TestLayer', state, 'test-cursor', vi.fn());
        const calls = (PubSub.subscribe as any).mock.calls.map((c: any[]) => c[0]);
        expect(calls).toContain(EventTopics.layerSelected);
        expect(calls).toContain(EventTopics.layerDeselected);
        expect(calls).toContain(EventTopics.mapClicked);
    });
});

// ---------------------------------------------------------------------------
// subscribePolylineLayerEvents
// ---------------------------------------------------------------------------

describe('subscribePolylineLayerEvents', () => {
    it('registers three PubSub subscribers', () => {
        const state = { selected: false };
        const layer = { eachLayer: vi.fn() };
        subscribePolylineLayerEvents('TestLayer', state, 'test', layer as any, () => null, vi.fn());
        expect(PubSub.subscribe).toHaveBeenCalledTimes(3);
    });

    it('subscriber topics are layerSelected, layerDeselected, drawCreated', () => {
        const state = { selected: false };
        const layer = { eachLayer: vi.fn() };
        subscribePolylineLayerEvents('TestLayer', state, 'test', layer as any, () => null, vi.fn());
        const calls = (PubSub.subscribe as any).mock.calls.map((c: any[]) => c[0]);
        expect(calls).toContain(EventTopics.layerSelected);
        expect(calls).toContain(EventTopics.layerDeselected);
        expect(calls).toContain(EventTopics.drawCreated);
    });
});
