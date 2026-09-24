/** Compatibility exports for existing layer callers. */
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

export { buildLegendEntry } from './legendEntry';
export type { LegendEntryOpts } from './legendEntry';
