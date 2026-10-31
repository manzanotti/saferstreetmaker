/**
 * Unit tests for layer helpers — toolbar buttons and legend entries.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import { buildToolbarButton } from '../../src/composables/layers/toolbarButton';
import { buildLegendEntry } from '../../src/composables/layers/legendEntry';
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

    it('sets iconSrc when provided', () => {
        const btn = buildToolbarButton({
            id: 'modal-filter',
            tooltip: 'Modal filter',
            groupName: 'filters',
            action: noop,
            selected: false,
            iconSrc: '/icons/modal-filter.svg'
        });
        expect(btn.iconSrc).toBe('/icons/modal-filter.svg');
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

    it('attaches the supplied icon and toggle tooltip', () => {
        const icon = document.createElement('i');
        const li = buildLegendEntry({
            layerId: 'ModalFilters',
            title: 'Modal Filters',
            toggleTitle: 'Toggle modal filters',
            iconEl: icon,
            visibilityState: { visible: true }
        });
        expect(li.firstElementChild).toBe(icon);
        expect(li.title).toBe('Toggle modal filters');
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
