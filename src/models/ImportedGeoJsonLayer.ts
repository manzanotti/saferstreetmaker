export interface ImportedGeoJsonLayer {
    id: string;
    name: string;
    nameProperty: string | null;
    visible?: boolean;
    featureCollection: GeoJSON.FeatureCollection;
}

export interface SerializedImportedGeoJsonLayer {
    id: string;
    name: string;
    nameProperty: string | null;
    visible?: boolean;
    featureCollection: GeoJSON.FeatureCollection;
}
