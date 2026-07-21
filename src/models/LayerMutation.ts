export type LayerMutationKind =
    | 'point-add'
    | 'point-delete'
    | 'point-batch-delete'
    | 'polyline-vertices-delete'
    | 'polygon-batch-delete'
    | 'polyline-add'
    | 'polyline-delete'
    | 'polyline-edit'
    | 'polygon-add'
    | 'polygon-delete'
    | 'polygon-edit';

export interface LayerMutationEvent {
    kind: LayerMutationKind;
    layerId: string;
    payload?: unknown;
}
