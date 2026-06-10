// Ambient declarations for the untyped Leaflet plugins used in this project.
// These describe just enough of the runtime surface that the application code
// relies on (leaflet.draw, leaflet-arrowheads) so that `tsc` can type-check.

import 'leaflet';

declare module 'leaflet' {
    // leaflet.draw – only the handlers the app constructs directly.
    namespace Draw {
        class Polyline {
            constructor(map: L.Map, options?: any);
            enable(): void;
            disable(): void;
        }
        class Polygon {
            constructor(map: L.Map, options?: any);
            enable(): void;
            disable(): void;
        }
    }

    // leaflet-arrowheads augments Polyline with an `arrowheads` method.
    interface Polyline {
        arrowheads(options?: any): this;
    }

    // The app stashes custom data on layers and reads GeoJSON feature arrays
    // directly off the GeoJSON layer.
    interface GeoJSON {
        features: any[];
    }

    interface Layer {
        properties?: any;
        editing?: { enable(): void; disable(): void };
    }

    interface LayerOptions {
        color?: string;
    }
}
