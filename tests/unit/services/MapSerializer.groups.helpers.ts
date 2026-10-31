/**
 * Shared layer, settings and group fixtures for the MapSerializer groups unit tests.
 */
import type { Group } from '../../../src/models/Group';

// Minimal IMapLayer stub.
export function makeLayer(id: string) {
    return {
        id,
        toGeoJSON: () => ({ type: 'FeatureCollection', features: [] })
    } as any;
}

export function makeSettings() {
    return {
        title: 'Test Map',
        readOnly: false,
        hideToolbar: false,
        activeLayers: ['ModalFilters'],
        centre: null,
        zoom: 12,
        version: '0.9.0'
    } as any;
}

export const groups: Group[] = [
    {
        id: 'group-1',
        name: 'School Zone',
        description: '<p><strong>Slow down</strong> near the school.</p>',
        color: '#00aa00',
        members: [
            { layerId: 'ModalFilters', historyId: 'hist-a' },
            { layerId: 'BusGates', historyId: 'hist-b' }
        ]
    },
    {
        id: 'group-2',
        name: 'Cycle Route',
        members: [{ layerId: 'MobilityLanes', historyId: 'hist-c' }]
    }
];

export const phasedGroup: Group = {
    id: 'group-phased',
    name: 'Phased Route',
    defaultVersionId: 'version-1',
    versions: [
        {
            id: 'version-1',
            name: 'Delivery plan',
            members: [
                { layerId: 'ModalFilters', historyId: 'hist-1' },
                { layerId: 'ModalFilters', historyId: 'hist-2' }
            ],
            phases: [
                {
                    id: 'phase-1',
                    members: [{ layerId: 'ModalFilters', historyId: 'hist-1' }]
                },
                {
                    id: 'phase-2',
                    members: [{ layerId: 'ModalFilters', historyId: 'hist-2' }]
                }
            ]
        }
    ]
};
