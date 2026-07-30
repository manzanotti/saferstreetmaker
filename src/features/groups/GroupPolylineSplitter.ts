import type * as L from 'leaflet';
import type { IMapLayer } from '../../composables/layers/IMapLayer';
import { buildClippedRuns, buildComplementRuns } from '../../geometry/polylineClipping';
import type { GroupMember, PartialPolylineSplit } from '../../models/Group';

interface GroupPolylineSplitterOptions {
    getLayer: (layerId: string) => IMapLayer | undefined;
    createHistoryId: () => string;
}

export class GroupPolylineSplitter {
    constructor(private readonly options: GroupPolylineSplitterOptions) {}

    split(splits: PartialPolylineSplit[]): GroupMember[] {
        const newMembers: GroupMember[] = [];

        for (const split of splits) {
            const layer = this.options.getLayer(split.layerId);
            if (!layer) {
                continue;
            }

            const selectedLatLngs = new Set<L.LatLng>(split.selectedLatLngs);
            const insideRuns = this.buildInsideRuns(split, selectedLatLngs);
            const remainingRuns = this.buildRemainingRuns(split, selectedLatLngs);
            const sourceProperties =
                (
                    split.marker as L.Layer & {
                        feature?: { properties?: GeoJSON.GeoJsonProperties };
                    }
                ).feature?.properties ?? {};

            layer.getLayer().removeLayer(split.marker);

            for (const run of insideRuns) {
                const historyId = this.createLine(layer, run, sourceProperties);
                newMembers.push({ layerId: split.layerId, historyId });
            }

            for (const run of remainingRuns) {
                this.createLine(layer, run, sourceProperties);
            }
        }

        return newMembers;
    }

    private buildInsideRuns(
        split: PartialPolylineSplit,
        selectedLatLngs: Set<L.LatLng>
    ): L.LatLng[][] {
        const runs = split.clipBounds
            ? buildClippedRuns(split.allLatLngs, selectedLatLngs, split.clipBounds)
            : split.selectedLatLngs.length >= 2
              ? [split.selectedLatLngs]
              : [];
        return runs.filter((run) => run.length >= 2);
    }

    private buildRemainingRuns(
        split: PartialPolylineSplit,
        selectedLatLngs: Set<L.LatLng>
    ): L.LatLng[][] {
        const runs = split.clipBounds
            ? buildComplementRuns(split.allLatLngs, selectedLatLngs, split.clipBounds)
            : [split.allLatLngs.filter((latLng) => !selectedLatLngs.has(latLng))];
        return runs.filter((run) => run.length >= 2);
    }

    private createLine(
        layer: IMapLayer,
        run: L.LatLng[],
        sourceProperties: GeoJSON.GeoJsonProperties
    ): string {
        const historyId = this.options.createHistoryId();
        const feature: GeoJSON.Feature<GeoJSON.LineString> = {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: run.map((latLng) => [latLng.lng, latLng.lat])
            },
            properties: { ...sourceProperties, historyId }
        };
        layer.loadFromGeoJSON({
            type: 'FeatureCollection',
            features: [feature]
        } as unknown as L.GeoJSON);
        return historyId;
    }
}
