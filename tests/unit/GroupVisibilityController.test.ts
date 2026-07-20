import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as L from 'leaflet';
import type { Group, GroupMember } from '../../src/models/Group';
import { GroupVisibilityController } from '../../src/features/groups/GroupVisibilityController';

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

    beforeEach(() => {
        groups = [];
        hiddenGroupIds = new Set<string>();
        markers = new Map<string, L.Layer>();
        controller = new GroupVisibilityController({
            getGroups: () => groups,
            getHiddenGroupIds: () => hiddenGroupIds,
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
});
