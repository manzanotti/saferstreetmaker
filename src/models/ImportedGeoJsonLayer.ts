export interface ImportedGeoJsonLayer {
    id: string;
    name: string;
    nameProperty: string | null;
    visible?: boolean;
    featureCollection: GeoJSON.FeatureCollection<GeoJSON.Geometry | null>;
}

export interface SerializedImportedGeoJsonLayer {
    id: string;
    name: string;
    nameProperty: string | null;
    visible?: boolean;
    featureCollection: GeoJSON.FeatureCollection<GeoJSON.Geometry | null>;
}
