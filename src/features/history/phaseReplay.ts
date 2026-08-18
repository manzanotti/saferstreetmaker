import type { GroupVersion } from '../../models/Group';
import type { PhaseMutationPayload } from '../../models/LayerMutation';
import type { SerializedMap } from '../../services/MapSerializer';
import type { HistoryReplayEntry } from '../../services/UndoJournal';
import { getGroupVersions } from '../groups/groupVersions';

export interface PhaseReplayContext {
    groupId: string;
    versionId: string;
    phaseId: string | null;
}

function phaseSignature(version: GroupVersion | undefined): string {
    return JSON.stringify(version?.phases ?? []);
}

function findVersion(snapshot: SerializedMap, groupId: string, versionId: string) {
    const group = snapshot.groups?.find((item) => item.id === groupId);
    return group ? getGroupVersions(group).find((item) => item.id === versionId) : undefined;
}

function isPhaseMutationPayload(value: unknown): value is PhaseMutationPayload {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const payload = value as Partial<PhaseMutationPayload>;
    return (
        typeof payload.groupId === 'string' &&
        typeof payload.versionId === 'string' &&
        (typeof payload.phaseId === 'string' || payload.phaseId === null) &&
        Array.isArray(payload.before) &&
        Array.isArray(payload.after)
    );
}

export function getPhaseReplayContext(
    replay: HistoryReplayEntry,
    preferred: PhaseReplayContext | null
): PhaseReplayContext | null {
    const mutation = replay.entry.mutationPayload;
    if (replay.entry.mutationKind === 'phase-update' && isPhaseMutationPayload(mutation)) {
        const targetVersion = findVersion(replay.snapshot, mutation.groupId, mutation.versionId);
        if (!targetVersion) {
            return null;
        }
        const phaseId = [preferred?.phaseId, mutation.phaseId].find((id): id is string =>
            Boolean(id && targetVersion.phases?.some((phase) => phase.id === id))
        );
        return {
            groupId: mutation.groupId,
            versionId: mutation.versionId,
            phaseId: phaseId ?? targetVersion.phases?.[0]?.id ?? null
        };
    }

    // Older checkpoints have no mutation metadata, so retain snapshot-based
    // detection for backwards compatibility with existing history entries.
    const before = replay.entry.before as SerializedMap;
    const after = replay.entry.after as SerializedMap;
    const candidates: Array<{ groupId: string; versionId: string }> = [];
    const groupIds = new Set([
        ...(before.groups ?? []).map((group) => group.id),
        ...(after.groups ?? []).map((group) => group.id)
    ]);

    for (const groupId of groupIds) {
        const beforeGroup = before.groups?.find((group) => group.id === groupId);
        const afterGroup = after.groups?.find((group) => group.id === groupId);
        const versionIds = new Set([
            ...(beforeGroup ? getGroupVersions(beforeGroup).map((version) => version.id) : []),
            ...(afterGroup ? getGroupVersions(afterGroup).map((version) => version.id) : [])
        ]);
        for (const versionId of versionIds) {
            if (
                phaseSignature(findVersion(before, groupId, versionId)) !==
                phaseSignature(findVersion(after, groupId, versionId))
            ) {
                candidates.push({ groupId, versionId });
            }
        }
    }

    const target =
        candidates.find(
            (candidate) =>
                candidate.groupId === preferred?.groupId &&
                candidate.versionId === preferred.versionId &&
                findVersion(replay.snapshot, candidate.groupId, candidate.versionId)
        ) ??
        candidates.find((candidate) =>
            findVersion(replay.snapshot, candidate.groupId, candidate.versionId)
        );
    if (!target) {
        return null;
    }

    const targetVersion = findVersion(replay.snapshot, target.groupId, target.versionId)!;
    const phaseId = targetVersion.phases?.some((phase) => phase.id === preferred?.phaseId)
        ? preferred!.phaseId
        : (targetVersion.phases?.[0]?.id ?? null);
    return { ...target, phaseId };
}
