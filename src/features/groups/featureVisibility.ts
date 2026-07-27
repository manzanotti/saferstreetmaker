import type * as L from 'leaflet';

const groupHiddenFeatures = new WeakSet<object>();

export function setFeatureGroupHidden(feature: L.Layer, hidden: boolean): void {
    if (hidden) {
        groupHiddenFeatures.add(feature as object);
    } else {
        groupHiddenFeatures.delete(feature as object);
    }
}

export function isFeatureGroupHidden(feature: L.Layer): boolean {
    return groupHiddenFeatures.has(feature as object);
}
