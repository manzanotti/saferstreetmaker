import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import {
  setMapCursor,
  removeMapCursor,
  buildToolbarButton,
  buildLegendEntry,
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

beforeEach(() => {
  document.getElementById('map')?.remove();
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
      id: 'x',
      tooltip: 'x',
      groupName: '',
      action: noop,
      selected: false,
      isFirst: true,
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
      text: 'LTN',
    });
    expect(btn.text).toBe('LTN');
  });

  it('does not set isFirst when not provided', () => {
    const btn = buildToolbarButton({
      id: 'x',
      tooltip: 'x',
      groupName: '',
      action: noop,
      selected: false,
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

  it('click toggles visible=true', () => {
    const state = { visible: false };
    const icon = document.createElement('i');
    const li = buildLegendEntry({
      layerId: 'ModalFilters',
      title: 'MF',
      toggleTitle: 'T',
      iconEl: icon,
      visibilityState: state,
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
      visibilityState: state,
    });
    li.click();
    expect(state.visible).toBe(false);
  });
});
