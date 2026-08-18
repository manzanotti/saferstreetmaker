import type { GroupMember } from '../../models/Group';
import { memberKey } from './groupVersions';

export function applyPhaseSelectionDelta(
    existingMembers: GroupMember[],
    selectedMembers: GroupMember[],
    previousSelectedKeys: Set<string>
): GroupMember[] {
    const selectedByKey = new Map(selectedMembers.map((member) => [memberKey(member), member]));
    const removedKeys = new Set(
        Array.from(previousSelectedKeys).filter((key) => !selectedByKey.has(key))
    );
    const addedMembers = selectedMembers.filter(
        (member) => !previousSelectedKeys.has(memberKey(member))
    );
    const reconciled = existingMembers.filter((member) => !removedKeys.has(memberKey(member)));
    const reconciledKeys = new Set(reconciled.map(memberKey));

    for (const member of addedMembers) {
        const key = memberKey(member);
        if (!reconciledKeys.has(key)) {
            reconciled.push({ ...member });
            reconciledKeys.add(key);
        }
    }

    return reconciled;
}
