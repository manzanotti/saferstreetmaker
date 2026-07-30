import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import * as L from 'leaflet';
import {
    setMapCursor,
    removeMapCursor,
    getPointSelectCursor,
    isPointFeatureElement,
    setMouseMarkerCursor,
    buildHistoryId,
    buildToolbarButton,
    buildLegendEntry,
    buildDeletePopup,
    buildFeatureActionPopup,
    buildFeatureDescriptionPopup,
    addFeatureHoverPopup,
    createFeatureHoverPopupController,
    getFeatureHoverLatLng,
    buildFeatureGroupMembershipContent,
    getFeatureHistoryId
} from '../../src/composables/layers/layerUtils';
import { useGroupStore } from '../../src/stores/groupStore';
import { pinia } from '../../src/stores';

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
    useGroupStore(pinia).setGroups([]);
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

describe('feature popups', () => {
    const member = { layerId: 'ModalFilters', historyId: 'filter-1' };

    function getPopupContent(popup: any): HTMLElement {
        return popup.setContent.mock.calls[0][0] as HTMLElement;
    }

    it('does not build a popup for an unnamed feature without groups', () => {
        const popup = buildFeatureDescriptionPopup({ minWidth: 30 }, member, 'hover', {
            iconSrc: '/icons/modal.svg'
        });

        expect(popup).toBeNull();
    });

    it('renders every available group description in a description popup', () => {
        useGroupStore(pinia).setGroups([
            {
                id: 'g1',
                name: 'Town centre',
                description: '<p>Slow <strong>traffic</strong></p>',
                members: [member]
            },
            {
                id: 'g2',
                name: 'School route',
                description: '<p>Protect crossings</p>',
                members: [member]
            },
            { id: 'g3', name: 'No notes', members: [member] }
        ]);

        const popup = buildFeatureDescriptionPopup({ minWidth: 30 }, member) as any;
        const content = getPopupContent(popup);

        expect(content.textContent).toContain('Town centre');
        expect(content.textContent).toContain('Slow traffic');
        expect(content.textContent).toContain('School route');
        expect(content.textContent).toContain('Protect crossings');
        expect(content.textContent).toContain('No notes');
        expect(content.querySelectorAll('.feature-popup-group-description')).toHaveLength(3);
        expect(content.querySelectorAll('.feature-popup-description')).toHaveLength(2);
        expect(popup.options.autoClose).toBe(false);
        expect(popup.options.autoPan).toBe(false);
        expect(popup.options.className).toBe('feature-popup-hover');
    });

    it('uses a separate class for interactive click description popups', () => {
        useGroupStore(pinia).setGroups([
            {
                id: 'g1',
                name: 'Town centre',
                description: '<a href="/details">View details</a>',
                members: [member]
            }
        ]);

        const popup = buildFeatureDescriptionPopup({ minWidth: 30 }, member, 'click') as any;

        expect(popup.options.autoPan).toBe(true);
        expect(popup.options.className).toBe('feature-popup-description');
        expect(popup.options.className).not.toBe('feature-popup-hover');
    });

    it('renders interactive group headings as non-submit buttons', () => {
        useGroupStore(pinia).setGroups([
            {
                id: 'g1',
                name: 'Town centre',
                members: [member]
            }
        ]);

        const popup = buildFeatureDescriptionPopup({ minWidth: 30 }, member, 'hover', {
            onOpenGroup: vi.fn()
        }) as any;
        const heading = getPopupContent(popup).querySelector('.group-link') as HTMLButtonElement;

        expect(heading.type).toBe('button');
    });

    it('orders toolbar icon, feature name, and group content', () => {
        useGroupStore(pinia).setGroups([
            {
                id: 'g1',
                name: 'Town centre',
                description: '<p>Slow traffic</p>',
                members: [member]
            }
        ]);

        const popup = buildFeatureDescriptionPopup({ minWidth: 30 }, member, 'hover', {
            featureName: 'Main crossing',
            iconSrc: '/icons/modal.svg'
        }) as any;
        const content = getPopupContent(popup);

        expect(content.children[0].classList.contains('feature-popup-feature-icon')).toBe(true);
        expect((content.children[0] as HTMLImageElement).alt).toBe('Modal filter');
        expect(content.children[1].classList.contains('feature-popup-feature-name')).toBe(true);
        expect(content.children[1].textContent).toBe('Main crossing');
        expect(content.children[2].classList.contains('feature-popup-group-description')).toBe(
            true
        );
        expect(content.children[2].textContent).toContain('Town centre');
    });

    it('renders toolbar-style text in the popup', () => {
        const popup = buildFeatureDescriptionPopup({ minWidth: 30 }, member, 'hover', {
            featureName: 'Cell',
            text: 'LTN'
        }) as any;
        const text = getPopupContent(popup).children[0];

        expect(text.tagName).toBe('SPAN');
        expect(text.classList.contains('feature-popup-feature-text')).toBe(true);
        expect(text.classList.contains('text-xl')).toBe(true);
        expect(text.classList.contains('font-bold')).toBe(true);
        expect(text.textContent).toBe('LTN');
    });

    it('keeps hover popups near the feature while clamping them to the viewport', () => {
        const popupElement = document.createElement('div');
        Object.defineProperties(popupElement, {
            offsetWidth: { value: 100 },
            offsetHeight: { value: 80 }
        });

        const popup = {
            setLatLng: vi.fn().mockReturnThis(),
            addTo: vi.fn().mockReturnThis(),
            getElement: () => popupElement
        } as any;
        const featureLatLng = new L.LatLng(5, 5);
        const map = {
            getSize: () => ({ x: 400, y: 300 }),
            latLngToContainerPoint: () => new L.Point(390, 290),
            containerPointToLatLng: (point: L.Point) => point
        } as any;

        addFeatureHoverPopup(map, popup, featureLatLng);

        expect(popup.setLatLng).toHaveBeenCalledTimes(2);
        expect(popup.setLatLng).toHaveBeenNthCalledWith(1, featureLatLng);
        expect(popup.setLatLng.mock.calls[1][0]).toMatchObject({ x: 338, y: 288 });
    });

    it('shifts an overlapping hover popup away from the legend', () => {
        const mapContainer = document.createElement('div');
        const legend = document.createElement('div');
        legend.classList.add('legend');
        mapContainer.appendChild(legend);
        Object.defineProperties(mapContainer, {
            getBoundingClientRect: {
                value: () => ({ left: 0, top: 0, right: 400, bottom: 300 })
            }
        });
        Object.defineProperties(legend, {
            getBoundingClientRect: {
                value: () => ({ left: 280, top: 0, right: 400, bottom: 100 })
            }
        });

        const popupElement = document.createElement('div');
        Object.defineProperties(popupElement, {
            offsetWidth: { value: 100 },
            offsetHeight: { value: 80 },
            getBoundingClientRect: {
                value: () => ({ left: 300, top: 20, right: 400, bottom: 100 })
            }
        });

        const popup = {
            setLatLng: vi.fn().mockReturnThis(),
            addTo: vi.fn().mockReturnThis(),
            getElement: () => popupElement
        } as any;
        const map = {
            getContainer: () => mapContainer,
            getSize: () => ({ x: 400, y: 300 }),
            latLngToContainerPoint: () => new L.Point(390, 100),
            containerPointToLatLng: (point: L.Point) => point
        } as any;

        addFeatureHoverPopup(map, popup, new L.LatLng(5, 5));

        expect(popup.setLatLng.mock.calls.at(-1)?.[0]).toMatchObject({ x: 218, y: 100 });
    });

    it('does not close a newer popup from a stale scheduled close', () => {
        vi.useFakeTimers();
        try {
            const firstPopup = {
                getElement: () => null,
                remove: vi.fn()
            } as unknown as L.Popup;
            const secondPopup = {
                getElement: () => null,
                remove: vi.fn()
            } as unknown as L.Popup;
            const controller = createFeatureHoverPopupController();

            controller.set(firstPopup);
            controller.scheduleClose();
            controller.set(secondPopup);
            vi.runAllTimers();

            expect(firstPopup.remove).not.toHaveBeenCalled();
            expect(secondPopup.remove).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it('uses the initial hover point only when the feature centre is outside the viewport', () => {
        const featureCenter = new L.LatLng(5, 5);
        const initialHoverLatLng = new L.LatLng(6, 6);
        const visibleMap = {
            getBounds: () => new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(10, 10))
        } as any;
        const offscreenMap = {
            getBounds: () => new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(4, 4))
        } as any;

        expect(getFeatureHoverLatLng(visibleMap, featureCenter, initialHoverLatLng)).toBe(
            featureCenter
        );
        expect(getFeatureHoverLatLng(offscreenMap, featureCenter, initialHoverLatLng)).toBe(
            initialHoverLatLng
        );
    });

    it('renders group version counts and action controls', () => {
        useGroupStore(pinia).setGroups([
            {
                id: 'g1',
                name: 'Town centre',
                versions: [
                    { id: 'v1', name: 'Current', members: [member] },
                    { id: 'v2', name: 'Alternative', members: [member] }
                ]
            }
        ]);
        const map = { closePopup: vi.fn() } as any;
        const onCopy = vi.fn();
        const onDelete = vi.fn();
        const onOpenGroup = vi.fn();
        const onRemoveFromGroup = vi.fn();

        const popup = buildFeatureActionPopup({
            map,
            popupOptions: { minWidth: 30 },
            member,
            onCopy,
            onDelete,
            onOpenGroup,
            onRemoveFromGroup
        }) as any;
        const content = getPopupContent(popup);

        expect(content.querySelector('.group-link')?.textContent).toBe('Town centre (2 versions)');
        expect(content.children[0].classList.contains('popup-buttons')).toBe(true);
        expect(content.children[1].classList.contains('feature-popup-groups')).toBe(true);
        expect(content.querySelector('.remove-feature-button')).not.toBeNull();
        expect(content.querySelector('.copy-button')).not.toBeNull();
        expect(content.querySelector('.delete-button')).not.toBeNull();

        (content.querySelector('.group-link') as HTMLElement).click();
        (content.querySelector('.remove-feature-button') as HTMLElement).click();
        (content.querySelector('.copy-button') as HTMLElement).click();
        (content.querySelector('ul.popup-buttons > li > .delete-button') as HTMLElement).click();

        expect(onOpenGroup).toHaveBeenCalledWith('g1');
        expect(onRemoveFromGroup).toHaveBeenCalledWith('g1');
        expect(onCopy).toHaveBeenCalledOnce();
        expect(onDelete).toHaveBeenCalledOnce();
        expect(map.closePopup).toHaveBeenCalledTimes(2);
    });

    it('does not build a description popup for an ungrouped feature', () => {
        const popup = buildFeatureDescriptionPopup({ minWidth: 30 }, member);

        expect(popup).toBeNull();
    });
});

describe('buildFeatureGroupMembershipContent', () => {
    const member = { layerId: 'ModalFilters', historyId: 'filter-1' };

    it('shows None and alphabetizes the add-to-group options', () => {
        useGroupStore(pinia).setGroups([
            { id: 'g2', name: 'Zebra Zone', members: [] },
            { id: 'g1', name: 'Alpha Zone', members: [] }
        ]);
        const onAddToGroup = vi.fn();
        const content = buildFeatureGroupMembershipContent(
            member,
            undefined,
            undefined,
            onAddToGroup
        );

        expect(content.querySelector('.feature-popup-groups strong')?.textContent).toBe('Groups');
        expect(content.querySelector('.feature-popup-group-none')?.textContent).toBe('None');

        const groupSelect = content.querySelector(
            '.add-feature-to-group-select'
        ) as HTMLSelectElement;
        expect([...groupSelect.options].map((option) => option.textContent)).toEqual([
            'Add to group…',
            'Alpha Zone',
            'Zebra Zone'
        ]);

        groupSelect.value = 'g1';
        groupSelect.dispatchEvent(new Event('change'));
        expect(onAddToGroup).toHaveBeenCalledWith('g1');
    });
});
