import * as L from 'leaflet';

export function getPolygonRings(layer: L.Layer): L.LatLng[][] {
    const raw = (layer as { getLatLngs?: () => unknown }).getLatLngs?.();
    if (!raw || !Array.isArray(raw) || raw.length === 0) {
        return [];
    }

    return Array.isArray(raw[0]) ? (raw as L.LatLng[][]) : [raw as L.LatLng[]];
}

export function getPolylineLatLngs(layer: L.Layer): L.LatLng[] {
    return getPolygonRings(layer).flat();
}

function boundsCorners(bounds: L.LatLngBounds): L.LatLng[] {
    const southWest = bounds.getSouthWest();
    const northEast = bounds.getNorthEast();

    return [
        southWest,
        new L.LatLng(southWest.lat, northEast.lng),
        northEast,
        new L.LatLng(northEast.lat, southWest.lng)
    ];
}

function pointInRing(point: L.LatLng, ring: L.LatLng[]): boolean {
    let inside = false;
    for (
        let index = 0, previousIndex = ring.length - 1;
        index < ring.length;
        previousIndex = index++
    ) {
        const current = ring[index];
        const previous = ring[previousIndex];
        const intersects =
            current.lat > point.lat !== previous.lat > point.lat &&
            point.lng <
                ((previous.lng - current.lng) * (point.lat - current.lat)) /
                    (previous.lat - current.lat) +
                    current.lng;

        if (intersects) {
            inside = !inside;
        }
    }
    return inside;
}

function orientation(a: L.LatLng, b: L.LatLng, c: L.LatLng): number {
    const value = (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
    if (Math.abs(value) < 1e-9) {
        return 0;
    }
    return value > 0 ? 1 : -1;
}

function onSegment(a: L.LatLng, b: L.LatLng, c: L.LatLng): boolean {
    return (
        Math.min(a.lng, c.lng) <= b.lng &&
        b.lng <= Math.max(a.lng, c.lng) &&
        Math.min(a.lat, c.lat) <= b.lat &&
        b.lat <= Math.max(a.lat, c.lat)
    );
}

function segmentsIntersect(a1: L.LatLng, a2: L.LatLng, b1: L.LatLng, b2: L.LatLng): boolean {
    const o1 = orientation(a1, a2, b1);
    const o2 = orientation(a1, a2, b2);
    const o3 = orientation(b1, b2, a1);
    const o4 = orientation(b1, b2, a2);

    if (o1 !== o2 && o3 !== o4) {
        return true;
    }

    return (
        (o1 === 0 && onSegment(a1, b1, a2)) ||
        (o2 === 0 && onSegment(a1, b2, a2)) ||
        (o3 === 0 && onSegment(b1, a1, b2)) ||
        (o4 === 0 && onSegment(b1, a2, b2))
    );
}

/**
 * Returns true when the bounds intersect the polygon's outer ring.
 * Polygon holes are intentionally ignored because current LTN cells do not use them.
 */
export function polygonIntersectsBounds(layer: L.Layer, bounds: L.LatLngBounds): boolean {
    const rings = getPolygonRings(layer);
    if (rings.length === 0) {
        return false;
    }

    const outerRing = rings[0];
    const rectCorners = boundsCorners(bounds);

    if (outerRing.some((vertex) => bounds.contains(vertex))) {
        return true;
    }

    if (rectCorners.some((corner) => pointInRing(corner, outerRing))) {
        return true;
    }

    const rectEdges: Array<[L.LatLng, L.LatLng]> = [
        [rectCorners[0], rectCorners[1]],
        [rectCorners[1], rectCorners[2]],
        [rectCorners[2], rectCorners[3]],
        [rectCorners[3], rectCorners[0]]
    ];

    for (let index = 0; index < outerRing.length; index++) {
        const current = outerRing[index];
        const next = outerRing[(index + 1) % outerRing.length];

        if (rectEdges.some(([start, end]) => segmentsIntersect(current, next, start, end))) {
            return true;
        }
    }

    return false;
}
