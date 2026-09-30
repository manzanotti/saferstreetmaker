import * as L from 'leaflet';
import type { IMapLayer } from '../../composables/layers/IMapLayer';
import { polygonIntersectsBounds } from '../../geometry/leafletGeometry';
import { isFeatureGroupHidden } from '../groups/featureVisibility';
import { shouldShowPointFeatures } from '../map/pointFeatureVisibility';

export interface VisibleLegendLayerOptions {
    map: L.Map;
    layers: IMapLayer[];
    activeLayerIds: readonly string[];
    visibleLayerIds: ReadonlySet<string>;
    legendLayerIds: ReadonlySet<string> | null;
}

type FeatureLayer = L.Layer & {
    eachLayer?: (callback: (layer: L.Layer) => void) => void;
    getLayers?: () => L.Layer[];
    getLatLng?: () => L.LatLng;
    getLatLngs?: () => unknown;
    getElement?: () => HTMLElement | SVGElement | undefined;
    options?: L.PathOptions & { radius?: number; icon?: L.Icon | L.DivIcon };
};

interface ScreenPoint {
    x: number;
    y: number;
}

function isLatLng(value: unknown): value is L.LatLng {
    return (
        typeof value === 'object' &&
        value !== null &&
        'lat' in value &&
        typeof value.lat === 'number' &&
        'lng' in value &&
        typeof value.lng === 'number'
    );
}

function isRendered(layer: FeatureLayer): boolean {
    if (isFeatureGroupHidden(layer)) {
        return false;
    }

    const element = layer.getElement?.();
    if (element) {
        const styles = window.getComputedStyle(element);
        if (
            element.style.display === 'none' ||
            styles.display === 'none' ||
            styles.visibility === 'hidden' ||
            Number(styles.opacity) === 0
        ) {
            return false;
        }
    }

    const opacity = layer.options?.opacity;
    return typeof opacity !== 'number' || opacity > 0;
}

function intersectsViewportPoint(map: L.Map, latLng: L.LatLng, feature: FeatureLayer): boolean {
    const size = map.getSize();
    const point = map.latLngToContainerPoint(latLng);
    const element = feature.getElement?.();
    let halfWidth = 0;
    let halfHeight = 0;

    if (element) {
        const mapRect = map.getContainer().getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        if (elementRect.width > 0 && elementRect.height > 0) {
            return (
                elementRect.right >= mapRect.left &&
                elementRect.left <= mapRect.right &&
                elementRect.bottom >= mapRect.top &&
                elementRect.top <= mapRect.bottom
            );
        }
    }

    if (typeof feature.options?.radius === 'number') {
        halfWidth = feature.options.radius;
        halfHeight = feature.options.radius;
    } else {
        const iconSize = feature.options?.icon?.options.iconSize;
        if (Array.isArray(iconSize)) {
            halfWidth = Number(iconSize[0]) / 2 || 0;
            halfHeight = Number(iconSize[1]) / 2 || 0;
        }
    }

    return (
        point.x + halfWidth >= 0 &&
        point.x - halfWidth <= size.x &&
        point.y + halfHeight >= 0 &&
        point.y - halfHeight <= size.y
    );
}

function pointInsideRect(point: ScreenPoint, width: number, height: number, padding: number) {
    return (
        point.x >= -padding &&
        point.x <= width + padding &&
        point.y >= -padding &&
        point.y <= height + padding
    );
}

function segmentIntersectsRect(
    start: ScreenPoint,
    end: ScreenPoint,
    width: number,
    height: number,
    padding: number
): boolean {
    const left = -padding;
    const top = -padding;
    const right = width + padding;
    const bottom = height + padding;
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const p = [-deltaX, deltaX, -deltaY, deltaY];
    const q = [start.x - left, right - start.x, start.y - top, bottom - start.y];
    let enter = 0;
    let exit = 1;

    for (let index = 0; index < p.length; index++) {
        if (p[index] === 0) {
            if (q[index] < 0) {
                return false;
            }
            continue;
        }

        const ratio = q[index] / p[index];
        if (p[index] < 0) {
            enter = Math.max(enter, ratio);
        } else {
            exit = Math.min(exit, ratio);
        }

        if (enter > exit) {
            return false;
        }
    }

    return true;
}

function hasLineInViewport(map: L.Map, feature: FeatureLayer): boolean {
    const raw = feature.getLatLngs?.();
    if (!Array.isArray(raw)) {
        return false;
    }

    const size = map.getSize();
    const padding = Math.max(0, Number(feature.options?.weight ?? 0) / 2);
    let visible = false;

    const inspectPath = (value: unknown): void => {
        if (visible || !Array.isArray(value)) {
            return;
        }

        if (value.length > 0 && isLatLng(value[0])) {
            const points = value.map((latLng) => map.latLngToContainerPoint(latLng));
            if (points.some((point) => pointInsideRect(point, size.x, size.y, padding))) {
                visible = true;
                return;
            }
            for (let index = 1; index < points.length; index++) {
                if (
                    segmentIntersectsRect(points[index - 1], points[index], size.x, size.y, padding)
                ) {
                    visible = true;
                    return;
                }
            }
            return;
        }

        for (const child of value) {
            inspectPath(child);
        }
    };

    inspectPath(raw);
    return visible;
}

function featureIntersectsViewport(map: L.Map, feature: FeatureLayer): boolean {
    if (!isRendered(feature)) {
        return false;
    }

    const groupLayers = feature.getLayers?.();
    if (groupLayers) {
        return groupLayers.some((child) => featureIntersectsViewport(map, child as FeatureLayer));
    }

    if (feature.getLatLng) {
        return (
            shouldShowPointFeatures(map) &&
            intersectsViewportPoint(map, feature.getLatLng(), feature)
        );
    }

    if (feature instanceof L.Polygon) {
        return polygonIntersectsBounds(feature, map.getBounds());
    }

    return hasLineInViewport(map, feature);
}

function layerHasVisibleFeature(map: L.Map, layer: IMapLayer): boolean {
    const featureGroup = layer.getLayer();
    if (!map.hasLayer(featureGroup)) {
        return false;
    }

    let found = false;
    featureGroup.eachLayer((feature) => {
        if (!found && featureIntersectsViewport(map, feature as FeatureLayer)) {
            found = true;
        }
    });
    return found;
}

export function getVisibleLegendLayers(options: VisibleLegendLayerOptions): IMapLayer[] {
    const { map, layers, activeLayerIds, visibleLayerIds, legendLayerIds } = options;
    const activeIds = new Set(activeLayerIds);

    return layers.filter(
        (layer) =>
            activeIds.has(layer.id) &&
            visibleLayerIds.has(layer.id) &&
            (legendLayerIds === null || legendLayerIds.has(layer.id)) &&
            layerHasVisibleFeature(map, layer)
    );
}
