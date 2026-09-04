import type * as L from 'leaflet';

export const POINT_FEATURE_ZOOM_OFFSET = 8;
export const POINT_FEATURE_SMALL_ZOOM_OFFSET = 4;

export function shouldShowPointFeatures(map: Pick<L.Map, 'getZoom' | 'getMaxZoom'>): boolean {
    return map.getZoom() > map.getMaxZoom() - POINT_FEATURE_ZOOM_OFFSET;
}

export function shouldReducePointFeatureSize(map: Pick<L.Map, 'getZoom' | 'getMaxZoom'>): boolean {
    return map.getZoom() <= map.getMaxZoom() - POINT_FEATURE_SMALL_ZOOM_OFFSET;
}
