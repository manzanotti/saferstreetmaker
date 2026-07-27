import * as L from 'leaflet';

interface MutationAreaRevealerOptions {
    getMap: () => L.Map;
}

export class MutationAreaRevealer {
    constructor(private readonly options: MutationAreaRevealerOptions) {}

    reveal(payload: unknown): void {
        const latLngs = this.collectLatLngs(payload);
        if (latLngs.length === 0) {
            return;
        }

        this.ensureBoundsVisible(L.latLngBounds(latLngs));
    }

    private collectLatLngs(payload: unknown): L.LatLng[] {
        const latLngs: L.LatLng[] = [];

        const addLngLat = (lng: unknown, lat: unknown): void => {
            if (
                typeof lng === 'number' &&
                typeof lat === 'number' &&
                Number.isFinite(lng) &&
                Number.isFinite(lat)
            ) {
                latLngs.push(new L.LatLng(lat, lng));
            }
        };

        const walkCoordinates = (coordinates: unknown): void => {
            if (!Array.isArray(coordinates)) {
                return;
            }
            if (
                coordinates.length === 2 &&
                typeof coordinates[0] === 'number' &&
                typeof coordinates[1] === 'number'
            ) {
                addLngLat(coordinates[0], coordinates[1]);
                return;
            }

            for (const child of coordinates) {
                walkCoordinates(child);
            }
        };

        const walk = (node: unknown): void => {
            if (node == null || typeof node !== 'object') {
                return;
            }
            if (Array.isArray(node)) {
                for (const child of node) {
                    walk(child);
                }
                return;
            }

            const value = node as Record<string, unknown>;
            if (typeof value.lat === 'number' && typeof value.lng === 'number') {
                addLngLat(value.lng, value.lat);
            }

            const geometry = value.geometry as Record<string, unknown> | undefined;
            if (geometry && 'coordinates' in geometry) {
                walkCoordinates(geometry.coordinates);
            }
            if ('coordinates' in value) {
                walkCoordinates(value.coordinates);
            }
            if (Array.isArray(value.beforeCoordinates)) {
                walkCoordinates(value.beforeCoordinates);
            }
            if (Array.isArray(value.afterCoordinates)) {
                walkCoordinates(value.afterCoordinates);
            }
            if (Array.isArray(value.pointChanges)) {
                for (const change of value.pointChanges) {
                    if (change && typeof change === 'object') {
                        const pointChange = change as Record<string, unknown>;
                        walkCoordinates(pointChange.before);
                        walkCoordinates(pointChange.after);
                    }
                }
            }
            if (Array.isArray(value.points)) {
                for (const point of value.points) {
                    walk(point);
                }
            }
            if (value.before && typeof value.before === 'object') {
                walk(value.before);
            }
            if (value.after && typeof value.after === 'object') {
                walk(value.after);
            }
        };

        walk(payload);
        return latLngs;
    }

    private ensureBoundsVisible(bounds: L.LatLngBounds): void {
        const map = this.options.getMap();
        const viewport = map.getBounds();
        const viewportLatSpan = viewport.getNorth() - viewport.getSouth();
        const viewportLngSpan = viewport.getEast() - viewport.getWest();
        const boundsLatSpan = bounds.getNorth() - bounds.getSouth();
        const boundsLngSpan = bounds.getEast() - bounds.getWest();

        if (boundsLatSpan <= viewportLatSpan && boundsLngSpan <= viewportLngSpan) {
            map.panTo(bounds.getCenter());
        } else {
            map.fitBounds(bounds, { padding: [40, 40] });
        }
    }
}
