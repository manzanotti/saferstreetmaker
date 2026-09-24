/**
 * layerUtils.ts
 *
 * Shared helpers for layer composables (cursor, toolbar button, legend entry,
 * and group popup builders). Hover, group-membership, action, and description popup behavior
 * live in focused modules and are re-exported here for existing layer callers.
 * Extracted from LayerHelpers.ts — PubSub removed entirely.
 *
 * Note on DOM usage: popup builders and `buildLegendEntry` use
 * `document.createElement` to construct HTML for Leaflet popups and the legacy
 * `getLegendEntry()` interface method. This is intentional — Leaflet manages
 * those DOM subtrees directly and they live outside Vue's virtual DOM.
 * Do not replace these with Vue components; keep the boundary here.
 */
export { getFeatureHistoryId, findLayerFeatureByHistoryId, buildHistoryId } from './featureLookup';
export {
    buildPopupActionControl,
    buildDeletePopup,
    setFeatureActionPopupContent,
    buildFeatureActionPopup
} from './featureActionPopup';
export type { FeatureActionPopupOptions } from './featureActionPopup';

export { buildReadOnlyGroupPopup, getReadOnlyGroupCenter } from './readOnlyGroupPopup';

export {
    buildFeatureGroupMembershipContent,
    disposePopupElement,
    cacheFeatureGroupElement,
    findFeatureGroupIdByElement,
    findFirstFeatureGroupId
} from './featureGroupMembershipPopup';

export {
    addFeatureHoverPopup,
    createFeatureHoverPopupController,
    getFeatureHoverLatLng,
    closeFeatureHoverPopups
} from './featureHoverPopups';
export type { FeatureHoverPopupController } from './featureHoverPopups';

export {
    setMapCursor,
    removeMapCursor,
    setFeatureElementCursor,
    setMouseMarkerCursor
} from './featureCursors';

export { isPointFeatureElement, isFeatureEditLayerButtonId } from './featureClassification';

export { buildFeatureDescriptionPopup } from './featureDescriptionPopup';
export type { FeatureDescriptionPopupDetails } from './featureDescriptionPopup';

export { buildToolbarButton } from './toolbarButton';
export type { ToolbarButtonOpts } from './toolbarButton';

// ---------------------------------------------------------------------------
// Legend entry builder
// ---------------------------------------------------------------------------

export interface LegendEntryOpts {
    layerId: string;
    title: string;
    toggleTitle: string;
    iconEl: HTMLElement;
    /** Object whose `visible` property is toggled on click. */
    visibilityState: { visible: boolean };
}

export function buildLegendEntry(opts: LegendEntryOpts): HTMLElement {
    const li = document.createElement('li');
    li.id = `${opts.layerId}-legend`;
    li.setAttribute('title', opts.toggleTitle);
    li.appendChild(opts.iconEl);

    const span = document.createElement('span');
    span.textContent = opts.title;
    li.appendChild(span);

    li.addEventListener('click', () => {
        opts.visibilityState.visible = !opts.visibilityState.visible;
        // Actual map visibility is handled by Legend.vue → mapStore.toggleLayerVisibility()
    });

    return li;
}
