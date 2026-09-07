import { useMapStore } from '../../stores/mapStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { featureKey, getActiveVersion } from '../../features/groups/groupVersions';
import { pinia } from '../../stores/index';
import { clearFeatureHighlight } from '../useAreaSelection';
import { buildAllFeatureMembers, phaseHighlighter } from './groupsShared';

export function applyReadOnlyGroupPresentation(version: ReturnType<typeof getActiveVersion>): void {
    const members = buildAllFeatureMembers();
    const groupKeys = new Set(
        version.members.map((member) => featureKey(member.layerId, member.historyId))
    );
    phaseHighlighter.dimOutside(members, groupKeys);
}

export function clearReadOnlyGroupPresentation(): void {
    phaseHighlighter.clear(buildAllFeatureMembers());
}

export function clearReadOnlyEditingState(): void {
    for (const layer of useMapStore(pinia).layers) {
        if (layer.kind !== 'polyline' && layer.kind !== 'polygon') {
            continue;
        }
        layer.getLayer().eachLayer((feature: any) => feature.editing?.disable?.());
    }
    clearFeatureHighlight();
    useSelectionStore(pinia).deactivate();
    useMapStore(pinia).setDrawLayer(null);
}

export function applyReadOnlyPhasePresentation(
    version: ReturnType<typeof getActiveVersion>,
    revealedMemberKeys: Set<string>,
    progress: number,
    completedMemberKeys = new Set<string>()
): void {
    const groupKeys = new Set(
        version.members.map((member) => featureKey(member.layerId, member.historyId))
    );
    phaseHighlighter.setProgress(
        buildAllFeatureMembers(),
        revealedMemberKeys,
        progress,
        completedMemberKeys,
        new Set(),
        groupKeys,
        0.12,
        0.28
    );
}
