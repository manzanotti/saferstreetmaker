import type * as L from 'leaflet';
import type { Group, GroupMember } from '../../models/Group';
import { getActiveVersion, getGroupVersions } from './groupVersions';

interface GroupVisibilityControllerOptions {
    getGroups: () => Group[];
    getHiddenGroupIds: () => Set<string>;
    getActiveVersionIds?: () => Record<string, string>;
    findMarker: (member: GroupMember) => L.Layer | null;
}

type VisibilityLayer = L.Layer & {
    getLatLng?: () => L.LatLng;
    getElement?: () => HTMLElement | undefined;
    setStyle?: (style: L.PathOptions) => void;
    options?: L.PathOptions;
};

interface OriginalStyle {
    opacity: number;
    fillOpacity: number;
}

export class GroupVisibilityController {
    private readonly originalStyles = new WeakMap<object, OriginalStyle>();
    private readonly hiddenMarkers = new Set<L.Layer>();

    constructor(private readonly options: GroupVisibilityControllerOptions) {}

    recompute(): void {
        const memberToGroupIds = new Map<string, Set<string>>();
        const inactiveMemberGroupIds = new Map<string, Set<string>>();
        const memberByKey = new Map<string, GroupMember>();
        const activeVersionIds = this.options.getActiveVersionIds?.() ?? {};

        for (const group of this.options.getGroups()) {
            const activeVersion = getActiveVersion(group, activeVersionIds[group.id]);
            const activeMemberKeys = new Set<string>();
            for (const member of activeVersion.members) {
                const key = `${member.layerId}:${member.historyId}`;
                activeMemberKeys.add(key);
                const groupIds = memberToGroupIds.get(key) ?? new Set<string>();
                groupIds.add(group.id);
                memberToGroupIds.set(key, groupIds);
                memberByKey.set(key, member);
            }
            for (const version of getGroupVersions(group)) {
                if (version.id === activeVersion.id) {
                    continue;
                }
                for (const member of version.members) {
                    const key = `${member.layerId}:${member.historyId}`;
                    if (activeMemberKeys.has(key)) {
                        continue;
                    }
                    const groupIds = inactiveMemberGroupIds.get(key) ?? new Set<string>();
                    groupIds.add(group.id);
                    inactiveMemberGroupIds.set(key, groupIds);
                    memberByKey.set(key, member);
                }
            }
        }

        const hiddenGroupIds = this.options.getHiddenGroupIds();
        const desiredHidden = new Set<L.Layer>();
        for (const [key, groupIds] of memberToGroupIds) {
            if (![...groupIds].every((groupId) => hiddenGroupIds.has(groupId))) {
                continue;
            }

            const member = memberByKey.get(key);
            if (!member) {
                continue;
            }

            const marker = this.options.findMarker(member);
            if (marker) {
                desiredHidden.add(marker);
            }
        }

        // A feature that belongs only to an inactive version must not remain
        // rendered after switching away from that version.
        for (const [key] of inactiveMemberGroupIds) {
            if (memberToGroupIds.has(key)) {
                continue;
            }
            const member = memberByKey.get(key);
            if (!member) {
                continue;
            }
            const marker = this.options.findMarker(member);
            if (marker) {
                desiredHidden.add(marker);
            }
        }

        for (const marker of [...this.hiddenMarkers]) {
            if (!desiredHidden.has(marker)) {
                this.reveal(marker);
            }
        }

        for (const marker of desiredHidden) {
            if (!this.hiddenMarkers.has(marker)) {
                this.hide(marker);
            }
        }
    }

    reset(): void {
        for (const marker of [...this.hiddenMarkers]) {
            this.reveal(marker);
        }
    }

    reveal(marker: L.Layer): void {
        const visibilityLayer = marker as VisibilityLayer;
        if (
            typeof visibilityLayer.getLatLng === 'function' &&
            typeof visibilityLayer.setStyle !== 'function'
        ) {
            const element = visibilityLayer.getElement?.();
            if (element) {
                element.style.display = '';
            }
        } else if (typeof visibilityLayer.setStyle === 'function') {
            const originalStyle = this.originalStyles.get(marker as object);
            if (originalStyle) {
                visibilityLayer.setStyle(originalStyle);
            }
        }

        this.originalStyles.delete(marker as object);
        this.hiddenMarkers.delete(marker);
    }

    private hide(marker: L.Layer): void {
        const visibilityLayer = marker as VisibilityLayer;
        if (
            typeof visibilityLayer.getLatLng === 'function' &&
            typeof visibilityLayer.setStyle !== 'function'
        ) {
            const element = visibilityLayer.getElement?.();
            if (element) {
                this.originalStyles.set(marker as object, { opacity: 1, fillOpacity: 0 });
                element.style.display = 'none';
                this.hiddenMarkers.add(marker);
            }
            return;
        }

        if (typeof visibilityLayer.setStyle === 'function') {
            this.originalStyles.set(marker as object, {
                opacity:
                    typeof visibilityLayer.options?.opacity === 'number'
                        ? visibilityLayer.options.opacity
                        : 1,
                fillOpacity:
                    typeof visibilityLayer.options?.fillOpacity === 'number'
                        ? visibilityLayer.options.fillOpacity
                        : 0
            });
            visibilityLayer.setStyle({ opacity: 0, fillOpacity: 0 });
            this.hiddenMarkers.add(marker);
        }
    }
}
