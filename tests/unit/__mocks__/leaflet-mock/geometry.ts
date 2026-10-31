/**
 * Leaflet mock geometry primitives: LatLng, LatLngBounds and Point.
 */
class LatLng {
    constructor(
        public lat: number,
        public lng: number
    ) {}
}

class LatLngBounds {
    private _sw: LatLng;
    private _ne: LatLng;

    constructor(a?: LatLng[] | LatLng, b?: LatLng) {
        if (Array.isArray(a)) {
            let minLat = Infinity;
            let minLng = Infinity;
            let maxLat = -Infinity;
            let maxLng = -Infinity;
            for (const ll of a) {
                minLat = Math.min(minLat, ll.lat);
                maxLat = Math.max(maxLat, ll.lat);
                minLng = Math.min(minLng, ll.lng);
                maxLng = Math.max(maxLng, ll.lng);
            }
            this._sw = new LatLng(minLat, minLng);
            this._ne = new LatLng(maxLat, maxLng);
        } else if (a && b) {
            this._sw = a;
            this._ne = b;
        } else {
            this._sw = new LatLng(0, 0);
            this._ne = new LatLng(0, 0);
        }
    }

    getNorth() {
        return this._ne.lat;
    }
    getSouth() {
        return this._sw.lat;
    }
    getEast() {
        return this._ne.lng;
    }
    getWest() {
        return this._sw.lng;
    }
    getCenter() {
        return new LatLng((this._sw.lat + this._ne.lat) / 2, (this._sw.lng + this._ne.lng) / 2);
    }
    contains(other: any) {
        if (other instanceof LatLngBounds) {
            return (
                other.getSouth() >= this.getSouth() &&
                other.getNorth() <= this.getNorth() &&
                other.getWest() >= this.getWest() &&
                other.getEast() <= this.getEast()
            );
        }
        return (
            other.lat >= this.getSouth() &&
            other.lat <= this.getNorth() &&
            other.lng >= this.getWest() &&
            other.lng <= this.getEast()
        );
    }
}

function latLngBounds(a?: LatLng[] | LatLng, b?: LatLng) {
    return new LatLngBounds(a, b);
}

class Point {
    constructor(
        public x: number,
        public y: number
    ) {}
}

function point(x: number, y: number) {
    return new Point(x, y);
}

export { LatLng, LatLngBounds, latLngBounds, Point, point };
