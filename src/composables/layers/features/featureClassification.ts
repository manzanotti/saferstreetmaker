const POINT_FEATURE_CLASSES = [
    'modal-filter-marker',
    'bus-gate-icon',
    'traffic-lights-icon',
    'pedestrian-lights-icon',
    'zebra-crossing-icon'
];

const FEATURE_EDIT_LAYER_BUTTON_IDS = new Set([
    'mobility-lane',
    'tram-line',
    'bus-lane',
    'car-free-street',
    'school-street',
    'one-way-street',
    'ltn'
]);

export function isPointFeatureElement(element: Element): boolean {
    return POINT_FEATURE_CLASSES.some((className) => element.classList.contains(className));
}

export function isFeatureEditLayerButtonId(id: string | null): boolean {
    return id !== null && FEATURE_EDIT_LAYER_BUTTON_IDS.has(id);
}
