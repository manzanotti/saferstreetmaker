import { ref, shallowRef, type Ref } from 'vue';
import type { Group, GroupMember, PartialPolylineSplit } from '../models/Group';

export function createGroupDialogState(groups: Ref<Group[]>) {
    const nameDialogOpen = ref(false);
    /** Non-null when the name dialog is being used for rename; null = create mode. */
    const renameGroupId = ref<string | null>(null);

    // pendingSplits contains L.Layer references — shallowRef prevents Vue Proxy wrapping.
    const pendingSplits = shallowRef<PartialPolylineSplit[]>([]);
    const splitDialogOpen = ref(false);

    /** Members to add when the next group is created (computed before opening nameDialog). */
    const pendingGroupMembers = ref<GroupMember[]>([]);
    const pendingGroupCreatedCallback = shallowRef<((groupId: string) => void) | null>(null);

    /**
     * When non-null, the area-selection flow is targeting an existing group:
     * confirming the selection adds the features to this group rather than
     * creating a new one. Drives the "Add to group" affordances in the
     * selection toolbar. Reset whenever selection is deactivated.
     */
    const addToGroupId = ref<string | null>(null);
    const pendingEmptyGroupDeletionId = ref<string | null>(null);
    const detailsGroupId = ref<string | null>(null);
    const phasesDialogOpen = ref(false);
    const phaseGroupId = ref<string | null>(null);
    const phaseVersionId = ref<string | null>(null);
    const phaseDraftActive = ref(false);
    const phaseEditingId = ref<string | null>(null);
    const pendingEmptyPhaseDeletionId = ref<string | null>(null);
    const focusedPhaseId = ref<string | null>(null);
    const playbackPlaying = ref(false);
    const playbackComplete = ref(false);
    const playbackPhaseIndex = ref<number | null>(null);

    function openNameDialog(forRenameId: string | null = null) {
        renameGroupId.value = forRenameId;
        nameDialogOpen.value = true;
    }

    function closeNameDialog() {
        nameDialogOpen.value = false;
        renameGroupId.value = null;
    }

    function openSplitDialog(splits: PartialPolylineSplit[]) {
        pendingSplits.value = splits;
        splitDialogOpen.value = true;
    }

    /**
     * Close the split dialog but RETAIN pendingSplits so the split can be
     * performed later when the group is confirmed (deferred split).
     */
    function approveSplitDialog() {
        splitDialogOpen.value = false;
    }

    function closeSplitDialog() {
        pendingSplits.value = [];
        splitDialogOpen.value = false;
    }

    function setPendingGroupMembers(members: GroupMember[]) {
        pendingGroupMembers.value = members;
    }

    function setPendingGroupCreatedCallback(callback: ((groupId: string) => void) | null) {
        pendingGroupCreatedCallback.value = callback;
    }

    function consumePendingGroupCreatedCallback() {
        const callback = pendingGroupCreatedCallback.value;
        pendingGroupCreatedCallback.value = null;
        return callback;
    }

    function setAddToGroupId(id: string | null) {
        addToGroupId.value = id;
    }

    function setPendingEmptyGroupDeletion(id: string | null) {
        pendingEmptyGroupDeletionId.value = id;
    }

    function openDetailsDialog(id: string) {
        if (groups.value.some((group) => group.id === id)) {
            detailsGroupId.value = id;
        }
    }

    function closeDetailsDialog() {
        detailsGroupId.value = null;
    }

    function openPhasesDialog(groupId: string, versionId: string) {
        phasesDialogOpen.value = true;
        phaseGroupId.value = groupId;
        phaseVersionId.value = versionId;
        phaseDraftActive.value = true;
        phaseEditingId.value = null;
        pendingEmptyPhaseDeletionId.value = null;
        focusedPhaseId.value = null;
    }

    function setReadOnlyPhaseContext(groupId: string, versionId: string) {
        phaseGroupId.value = groupId;
        phaseVersionId.value = versionId;
        phaseDraftActive.value = false;
        phaseEditingId.value = null;
        pendingEmptyPhaseDeletionId.value = null;
        focusedPhaseId.value = null;
        playbackPlaying.value = false;
        playbackComplete.value = false;
        playbackPhaseIndex.value = null;
    }

    function closePhasesDialog() {
        phasesDialogOpen.value = false;
        phaseGroupId.value = null;
        phaseVersionId.value = null;
        phaseDraftActive.value = false;
        phaseEditingId.value = null;
        pendingEmptyPhaseDeletionId.value = null;
        focusedPhaseId.value = null;
        playbackPlaying.value = false;
        playbackComplete.value = false;
        playbackPhaseIndex.value = null;
    }

    function setFocusedPhase(id: string | null) {
        focusedPhaseId.value = id;
    }

    function clearPendingState() {
        nameDialogOpen.value = false;
        splitDialogOpen.value = false;
        pendingGroupMembers.value = [];
        pendingSplits.value = [];
        pendingGroupCreatedCallback.value = null;
        renameGroupId.value = null;
        addToGroupId.value = null;
        pendingEmptyGroupDeletionId.value = null;
        detailsGroupId.value = null;
        closePhasesDialog();
    }

    return {
        nameDialogOpen,
        renameGroupId,
        pendingSplits,
        splitDialogOpen,
        pendingGroupMembers,
        pendingGroupCreatedCallback,
        addToGroupId,
        pendingEmptyGroupDeletionId,
        detailsGroupId,
        phasesDialogOpen,
        phaseGroupId,
        phaseVersionId,
        phaseDraftActive,
        phaseEditingId,
        pendingEmptyPhaseDeletionId,
        focusedPhaseId,
        playbackPlaying,
        playbackComplete,
        playbackPhaseIndex,
        openNameDialog,
        closeNameDialog,
        openSplitDialog,
        approveSplitDialog,
        closeSplitDialog,
        setPendingGroupMembers,
        setPendingGroupCreatedCallback,
        consumePendingGroupCreatedCallback,
        setAddToGroupId,
        setPendingEmptyGroupDeletion,
        openDetailsDialog,
        closeDetailsDialog,
        openPhasesDialog,
        setReadOnlyPhaseContext,
        closePhasesDialog,
        setFocusedPhase,
        clearPendingState
    };
}
