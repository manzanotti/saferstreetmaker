import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as L from 'leaflet';
import type { Group, GroupMember } from '../../src/models/Group';
import { GroupVisibilityController } from '../../src/features/groups/GroupVisibilityController';
import { isFeatureGroupHidden } from '../../src/features/groups/featureVisibility';

function member(historyId: string): GroupMember {
    return { layerId: 'ModalFilters', historyId };
}

function group(id: string, members: GroupMember[]): Group {
    return { id, name: id, members };
}

function styledMarker(): L.Layer & {
    options: L.PathOptions;
    setStyle: ReturnType<typeof vi.fn>;
} {
    const marker = {
        options: { opacity: 0.7, fillOpacity: 0.4 },
        getLatLng: () => ({ lat: 1, lng: 2 }),
        setStyle: vi.fn((style: L.PathOptions) => Object.assign(marker.options, style))
    };
    return marker as unknown as L.Layer & {
        options: L.PathOptions;
        setStyle: ReturnType<typeof vi.fn>;
    };
}

describe('GroupVisibilityController', () => {
    let groups: Group[];
    let hiddenGroupIds: Set<string>;
    let markers: Map<string, L.Layer>;
    let controller: GroupVisibilityController;
    let soloGroupId: string | null;

    beforeEach(() => {
        groups = [];
        hiddenGroupIds = new Set<string>();
        markers = new Map<string, L.Layer>();
        soloGroupId = null;
        controller = new GroupVisibilityController({
            getGroups: () => groups,
            getHiddenGroupIds: () => hiddenGroupIds,
            getSoloGroupId: () => soloGroupId,
            getAllMarkers: () => [...markers.values()],
            findMarker: ({ historyId }) => markers.get(historyId) ?? null
        });
    });

    it('restores a styled marker to its original opacity', () => {
        const marker = styledMarker();
        markers.set('h1', marker);
        groups = [group('g1', [member('h1')])];
        hiddenGroupIds.add('g1');

        controller.recompute();
        expect(marker.options).toMatchObject({ opacity: 0, fillOpacity: 0 });

        hiddenGroupIds.clear();
        controller.recompute();
        expect(marker.options).toMatchObject({ opacity: 0.7, fillOpacity: 0.4 });
    });

    it('ends an active edit session before hiding its feature and does not restart it on reveal', () => {
        let editingEnabled = true;
        const editing = {
            enabled: () => editingEnabled,
            disable: vi.fn(() => {
                editingEnabled = false;
            })
        };
        const marker = Object.assign(styledMarker(), { editing });
        const endEditMode = vi.fn();
        markers.set('h1', marker);
        groups = [group('g1', [member('h1')])];
        controller = new GroupVisibilityController({
            getGroups: () => groups,
            getHiddenGroupIds: () => hiddenGroupIds,
            findMarker: () => marker,
            onHideEditedFeature: endEditMode
        });
        hiddenGroupIds.add('g1');
        controller.recompute();
        controller.recompute();
        expect(endEditMode).toHaveBeenCalledOnce();
        expect(editing.disable).toHaveBeenCalledOnce();
        hiddenGroupIds.clear();
        controller.recompute();
        expect(editingEnabled).toBe(false);
        expect(marker.options.opacity).toBe(0.7);
        hiddenGroupIds.add('g1');
        controller.recompute();
        expect(endEditMode).toHaveBeenCalledOnce();
    });

    it('redraws arrowheads after hiding and revealing a line, without redrawing while already hidden', () => {
        const marker = Object.assign(styledMarker(), { _hatsApplied: true, redraw: vi.fn() });
        markers.set('h1', marker);
        groups = [group('g1', [member('h1')])];

        hiddenGroupIds.add('g1');
        controller.recompute();
        expect(marker.options).toMatchObject({ opacity: 0, fillOpacity: 0 });
        expect(marker.redraw).toHaveBeenCalledOnce();
        expect(marker.redraw.mock.invocationCallOrder[0]).toBeGreaterThan(
            marker.setStyle.mock.invocationCallOrder[0]
        );

        controller.recompute();
        expect(marker.setStyle).toHaveBeenCalledOnce();
        expect(marker.redraw).toHaveBeenCalledOnce();

        hiddenGroupIds.clear();
        controller.recompute();
        expect(marker.options).toMatchObject({ opacity: 0.7, fillOpacity: 0.4 });
        expect(marker.redraw).toHaveBeenCalledTimes(2);
    });

    it('does not redraw lines that have no arrowheads', () => {
        const marker = Object.assign(styledMarker(), { redraw: vi.fn() });
        markers.set('h1', marker);
        groups = [group('g1', [member('h1')])];
        hiddenGroupIds.add('g1');
        controller.recompute();
        hiddenGroupIds.clear();
        controller.recompute();
        expect(marker.redraw).not.toHaveBeenCalled();
    });

    it('isolates shared members and hides ungrouped and unrelated features reversibly', () => {
        const shared = styledMarker();
        const other = styledMarker();
        const ungrouped = styledMarker();
        markers.set('shared', shared);
        markers.set('other', other);
        markers.set('ungrouped', ungrouped);
        groups = [
            group('g1', [member('shared')]),
            group('g2', [member('shared'), member('other')])
        ];
        soloGroupId = 'g1';
        controller.recompute();
        controller.recompute();
        expect(isFeatureGroupHidden(shared)).toBe(false);
        expect(other.options.opacity).toBe(0);
        expect(isFeatureGroupHidden(ungrouped)).toBe(true);
        soloGroupId = null;
        controller.recompute();
        expect(other.options).toMatchObject({ opacity: 0.7, fillOpacity: 0.4 });
        expect(ungrouped.options).toMatchObject({ opacity: 0.7, fillOpacity: 0.4 });
    });

    it('hides newly added markers and restores point interaction on solo exit', () => {
        groups = [group('g1', [member('target')])];
        markers.set('target', styledMarker());
        soloGroupId = 'g1';
        controller.recompute();
        const element = document.createElement('div');
        element.style.pointerEvents = 'auto';
        const point = {
            getLatLng: () => ({ lat: 1, lng: 2 }),
            getElement: () => element,
            closePopup: vi.fn()
        } as unknown as L.Layer;
        markers.set('new', point);
        controller.recompute();
        expect(element.style.display).toBe('none');
        expect(element.style.pointerEvents).toBe('none');
        expect(point.closePopup).toHaveBeenCalled();
        soloGroupId = null;
        controller.recompute();
        expect(element.style.display).toBe('');
        expect(element.style.pointerEvents).toBe('auto');
    });

    it('keeps a shared member visible until all containing groups are hidden', () => {
        const marker = styledMarker();
        markers.set('h1', marker);
        groups = [group('g1', [member('h1')]), group('g2', [member('h1')])];
        hiddenGroupIds.add('g1');

        controller.recompute();
        expect(marker.options.opacity).toBe(0.7);

        hiddenGroupIds.add('g2');
        controller.recompute();
        expect(marker.options.opacity).toBe(0);
    });

    it('reveals a marker that is no longer referenced by any group', () => {
        const marker = styledMarker();
        markers.set('h1', marker);
        groups = [group('g1', [member('h1')])];
        hiddenGroupIds.add('g1');
        controller.recompute();

        groups = [];
        controller.recompute();

        expect(marker.options).toMatchObject({ opacity: 0.7, fillOpacity: 0.4 });
    });

    it('hides and restores a DivIcon marker through its element display', () => {
        const element = document.createElement('div');
        const marker = {
            getLatLng: () => ({ lat: 1, lng: 2 }),
            getElement: () => element
        } as unknown as L.Layer;
        markers.set('h1', marker);
        groups = [group('g1', [member('h1')])];
        hiddenGroupIds.add('g1');

        controller.recompute();
        expect(element.style.display).toBe('none');

        controller.reset();
        expect(element.style.display).toBe('');
    });

    it('hides members that belong only to an inactive version', () => {
        const defaultMarker = styledMarker();
        const alternativeMarker = styledMarker();
        markers.set('default', defaultMarker);
        markers.set('alternative', alternativeMarker);
        groups = [
            {
                id: 'g1',
                name: 'g1',
                defaultVersionId: 'v-default',
                versions: [
                    { id: 'v-default', name: 'Default', members: [member('default')] },
                    { id: 'v-alternative', name: 'Alternative', members: [member('alternative')] }
                ],
                members: [member('default')]
            }
        ];

        controller.recompute();
        expect(defaultMarker.options.opacity).toBe(0.7);
        expect(alternativeMarker.options.opacity).toBe(0);
    });

    it('hides and restores a permanent tooltip with an inactive version member', () => {
        const marker = styledMarker() as ReturnType<typeof styledMarker> & {
            closeTooltip: ReturnType<typeof vi.fn>;
            openTooltip: ReturnType<typeof vi.fn>;
            syncGroupVisibility: ReturnType<typeof vi.fn>;
        };
        marker.closeTooltip = vi.fn();
        marker.openTooltip = vi.fn();
        marker.syncGroupVisibility = vi.fn(() => {
            if (isFeatureGroupHidden(marker)) {
                marker.closeTooltip();
            } else {
                marker.openTooltip();
            }
        });
        markers.set('h1', marker);
        groups = [group('g1', [member('h1')])];
        hiddenGroupIds.add('g1');

        controller.recompute();

        expect(marker.closeTooltip).toHaveBeenCalledOnce();
        expect(isFeatureGroupHidden(marker)).toBe(true);

        hiddenGroupIds.clear();
        controller.recompute();

        expect(marker.openTooltip).toHaveBeenCalledOnce();
        expect(isFeatureGroupHidden(marker)).toBe(false);
    });
});
