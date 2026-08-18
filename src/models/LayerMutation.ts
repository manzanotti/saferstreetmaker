import type { GroupPhase } from './Group';

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
    | 'polygon-edit'
    | 'phase-update';

export interface PhaseMutationPayload {
    groupId: string;
    versionId: string;
    phaseId: string | null;
    before: GroupPhase[];
    after: GroupPhase[];
}

export interface PhaseMutationEvent {
    kind: 'phase-update';
    layerId: 'groups';
    payload: PhaseMutationPayload;
}

export interface LayerMutationEvent {
    kind: LayerMutationKind;
    layerId: string;
    payload?: unknown;
}
