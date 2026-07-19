import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import {
    setMapCursor,
    removeMapCursor,
    getPointSelectCursor,
    isPointFeatureElement,
    setMouseMarkerCursor,
    buildHistoryId,
    buildToolbarButton,
    buildLegendEntry,
    buildDeletePopup
} from '../../src/composables/layers/layerUtils';

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

function makeMouseMarkerEl() {
    const el = document.createElement('div');
    el.classList.add('leaflet-mouse-marker');
    document.body.appendChild(el);
    return el;
}

beforeEach(() => {
    document.getElementById('map')?.remove();
    document.querySelector('.leaflet-mouse-marker')?.remove();
    vi.clearAllMocks();
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

describe('getPointSelectCursor', () => {
    it('returns the configured map css variable when present', () => {
        const el = makeMapEl();
        el.style.setProperty('--point-select-cursor', 'copy');

        expect(getPointSelectCursor()).toBe('copy');
    });

    it('falls back to pointer when the variable is missing', () => {
        makeMapEl();

        expect(getPointSelectCursor()).toBe('pointer');
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

describe('buildHistoryId', () => {
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

describe('buildToolbarButton', () => {
    const noop = () => {};

    it('sets all required properties', () => {
        const btn = buildToolbarButton({
            id: 'modal-filter',
            tooltip: 'Add modal filters',
            groupName: 'filters',
            action: noop,
            selected: false
        });
        expect(btn.id).toBe('modal-filter');
        expect(btn.tooltip).toBe('Add modal filters');
        expect(btn.groupName).toBe('filters');
        expect(btn.action).toBe(noop);
        expect(btn.selected).toBe(false);
    });

    it('sets isFirst when provided', () => {
        const btn = buildToolbarButton({
            id: 'x',
            tooltip: 'x',
            groupName: '',
            action: noop,
            selected: false,
            isFirst: true
        });
        expect(btn.isFirst).toBe(true);
    });

    it('sets text when provided', () => {
        const btn = buildToolbarButton({
            id: 'ltn',
            tooltip: 'LTN',
            groupName: '',
            action: noop,
            selected: false,
            text: 'LTN'
        });
        expect(btn.text).toBe('LTN');
    });

    it('does not set isFirst when not provided', () => {
        const btn = buildToolbarButton({
            id: 'x',
            tooltip: 'x',
            groupName: '',
            action: noop,
            selected: false
        });
        expect(btn.isFirst).toBeUndefined();
    });
});

describe('buildLegendEntry', () => {
    it('creates an li with the correct id', () => {
        const icon = document.createElement('i');
        const li = buildLegendEntry({
            layerId: 'ModalFilters',
            title: 'Modal Filters',
            toggleTitle: 'Toggle',
            iconEl: icon,
            visibilityState: { visible: false }
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
            visibilityState: { visible: false }
        });
        expect(li.textContent).toContain('Bus Gates');
    });

    it('click toggles visible=true', () => {
        const state = { visible: false };
        const icon = document.createElement('i');
        const li = buildLegendEntry({
            layerId: 'ModalFilters',
            title: 'MF',
            toggleTitle: 'T',
            iconEl: icon,
            visibilityState: state
        });
        li.click();
        expect(state.visible).toBe(true);
    });

    it('click toggles visible=false on second click', () => {
        const state = { visible: true };
        const icon = document.createElement('i');
        const li = buildLegendEntry({
            layerId: 'ModalFilters',
            title: 'MF',
            toggleTitle: 'T',
            iconEl: icon,
            visibilityState: state
        });
        li.click();
        expect(state.visible).toBe(false);
    });
});

describe('buildDeletePopup', () => {
    function getPopupContent(onDelete = vi.fn(), onCopy?: () => void) {
        const map = { closePopup: vi.fn() } as any;
        const popup = buildDeletePopup(map, { minWidth: 30 }, onDelete, onCopy) as any;
        const content = popup.setContent.mock.calls[0][0] as HTMLElement;
        return { map, popup, content };
    }

    it('renders accessible copy and delete controls when copy is enabled', () => {
        const { content } = getPopupContent(vi.fn(), vi.fn());
        const items = content.querySelectorAll('li');
        const controls = content.querySelectorAll('button');

        expect(items).toHaveLength(2);
        expect(controls).toHaveLength(2);
        expect(Array.from(content.children).every((child) => child.tagName === 'LI')).toBe(true);
        expect(controls[0].getAttribute('type')).toBe('button');
        expect(controls[0].getAttribute('aria-label')).toBe('Copy selected feature');
        expect(controls[1].getAttribute('type')).toBe('button');
        expect(controls[1].getAttribute('aria-label')).toBe('Delete selected feature');
    });

    it('activates copy on click and closes the popup', () => {
        const onCopy = vi.fn();
        const { map, content } = getPopupContent(vi.fn(), onCopy);
        const copyControl = content.querySelector('.copy-button') as HTMLElement;

        copyControl.click();

        expect(onCopy).toHaveBeenCalledOnce();
        expect(map.closePopup).toHaveBeenCalledOnce();
    });

    it('activates delete on click and closes the popup', () => {
        const onDelete = vi.fn();
        const { map, content } = getPopupContent(onDelete);
        const deleteControl = content.querySelector('.delete-button') as HTMLElement;

        deleteControl.click();

        expect(onDelete).toHaveBeenCalledOnce();
        expect(map.closePopup).toHaveBeenCalledOnce();
    });
});
