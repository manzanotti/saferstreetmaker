import { describe, expect, it, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import type * as L from 'leaflet';
import { SelectionHighlighter } from '../../src/features/selection/SelectionHighlighter';
import type { SelectedMarker } from '../../src/stores/selectionStore';
import { setFeatureGroupHidden } from '../../src/features/groups/featureVisibility';

function selected(marker: L.Layer): SelectedMarker {
    return {
        layerId: 'TestLayer',
        historyId: null,
        latLng: { lat: 1, lng: 2 } as L.LatLng,
        marker
    };
}

describe('SelectionHighlighter', () => {
    it('does not add styles or vertex handles to group-hidden features', () => {
        const setStyle = vi.fn();
        const hiddenPoint = {
            getLatLng: () => ({ lat: 1, lng: 2 }),
            setStyle
        } as unknown as L.Layer;
        const hiddenLine = {} as L.Layer;
        setFeatureGroupHidden(hiddenPoint, true);
        setFeatureGroupHidden(hiddenLine, true);
        const highlighter = new SelectionHighlighter({} as L.Map);
        highlighter.add([selected(hiddenPoint), selected(hiddenLine)]);
        expect(setStyle).not.toHaveBeenCalled();
    });
    it('adds and removes the selected class for DivIcon markers', () => {
        const element = document.createElement('div');
        const marker = {
            getLatLng: () => ({ lat: 1, lng: 2 }),
            getElement: () => element
        } as unknown as L.Layer;
        const highlighter = new SelectionHighlighter({} as L.Map);

        highlighter.add([selected(marker)]);
        expect(element.classList.contains('area-selected')).toBe(true);

        highlighter.clear([selected(marker)]);
        expect(element.classList.contains('area-selected')).toBe(false);
    });

    it('restores the original style for CircleMarker-style points', () => {
        const setStyle = vi.fn();
        const marker = {
            getLatLng: () => ({ lat: 1, lng: 2 }),
            options: { color: 'green', weight: 7 },
            setStyle
        } as unknown as L.Layer;
        const highlighter = new SelectionHighlighter({} as L.Map);

        highlighter.add([selected(marker)]);
        expect(setStyle).toHaveBeenLastCalledWith({ color: '#3b82f6', weight: 3 });

        highlighter.clear([selected(marker)]);
        expect(setStyle).toHaveBeenLastCalledWith({ color: 'green', weight: 7 });
    });

    it('resyncs group styling after restoring a selected feature style', () => {
        const setStyle = vi.fn();
        const syncGroupStyle = vi.fn();
        const marker = {
            getLatLng: () => ({ lat: 1, lng: 2 }),
            options: { color: 'green', weight: 7 },
            setStyle,
            syncGroupStyle
        } as unknown as L.Layer;
        const highlighter = new SelectionHighlighter({} as L.Map);

        highlighter.add([selected(marker)]);
        highlighter.clear([selected(marker)]);

        expect(syncGroupStyle).toHaveBeenCalledOnce();
    });

    it('replaces the previous marker highlight', () => {
        const previousElement = document.createElement('div');
        const nextElement = document.createElement('div');
        const previous = selected({
            getLatLng: () => ({ lat: 1, lng: 2 }),
            getElement: () => previousElement
        } as unknown as L.Layer);
        const next = selected({
            getLatLng: () => ({ lat: 3, lng: 4 }),
            getElement: () => nextElement
        } as unknown as L.Layer);
        const highlighter = new SelectionHighlighter({} as L.Map);

        highlighter.add([previous]);
        highlighter.replace([previous], [next]);

        expect(previousElement.classList.contains('area-selected')).toBe(false);
        expect(nextElement.classList.contains('area-selected')).toBe(true);
    });
});
