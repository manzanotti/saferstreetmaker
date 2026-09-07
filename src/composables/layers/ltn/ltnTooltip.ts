// ── LTN tooltip visibility helpers ───────────────────────────────────────
// Extracted from useLtnLayer.ts.

import * as L from 'leaflet';
import { isFeatureGroupHidden } from '../../../features/groups/featureVisibility';

export const shouldShowLabel = (map: L.Map, label: string): boolean => {
    return map.getZoom() >= 14 && label.length > 0;
};

export const syncTooltipVisibility = (map: L.Map, polygon: any): void => {
    const label = polygon['properties']?.label ?? '';
    if (!isFeatureGroupHidden(polygon) && shouldShowLabel(map, label)) {
        polygon.openTooltip?.();
    } else {
        polygon.closeTooltip?.();
    }
};

export const syncPolygonTooltip = (map: L.Map, polygon: any, label?: string): void => {
    const nextLabel = label ?? polygon['properties']?.label ?? '';
    polygon.setTooltipContent?.(nextLabel);
    polygon.getTooltip?.()?.setLatLng?.(polygon.getBounds().getCenter());
    syncTooltipVisibility(map, polygon);
};
