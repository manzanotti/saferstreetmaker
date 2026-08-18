import type * as L from 'leaflet';
import type { GroupMember } from '../../models/Group';
import { memberKey } from './groupVersions';

type StyledLayer = L.Layer & {
    getElement?: () => HTMLElement | undefined;
    setStyle?: (style: L.PathOptions) => void;
    syncGroupStyle?: () => void;
    options?: L.PathOptions & L.LayerOptions;
};

interface OriginalPathStyle {
    opacity?: number;
    fillOpacity?: number;
}

export class PhaseHighlighter {
    private readonly originalPathStyles = new WeakMap<object, OriginalPathStyle>();
    private readonly originalElementOpacity = new WeakMap<object, string>();

    constructor(private readonly findMarker: (member: GroupMember) => L.Layer | null) {}

    dim(members: GroupMember[], focusedMemberKeys: Set<string>): void {
        this.clear(members);
        for (const member of members) {
            if (focusedMemberKeys.has(memberKey(member))) {
                continue;
            }
            const marker = this.findMarker(member);
            if (!marker) {
                continue;
            }
            const styled = marker as StyledLayer;
            if (typeof styled.setStyle === 'function') {
                this.originalPathStyles.set(marker as object, {
                    opacity: styled.options?.opacity,
                    fillOpacity: styled.options?.fillOpacity
                });
                styled.setStyle({
                    opacity: 0.28,
                    fillOpacity:
                        typeof styled.options?.fillOpacity === 'number'
                            ? styled.options.fillOpacity * 0.28
                            : 0.28
                });
                styled.syncGroupStyle?.();
            } else {
                const element = styled.getElement?.();
                if (element) {
                    this.originalElementOpacity.set(marker as object, element.style.opacity);
                    element.style.opacity = '0.28';
                }
            }
        }
    }

    clear(members: GroupMember[]): void {
        for (const member of members) {
            const marker = this.findMarker(member);
            if (!marker) {
                continue;
            }
            const styled = marker as StyledLayer;
            const pathStyle = this.originalPathStyles.get(marker as object);
            if (pathStyle && typeof styled.setStyle === 'function') {
                styled.setStyle(pathStyle);
                styled.syncGroupStyle?.();
                this.originalPathStyles.delete(marker as object);
            } else {
                const element = styled.getElement?.();
                const originalOpacity = this.originalElementOpacity.get(marker as object);
                if (element && originalOpacity !== undefined) {
                    element.style.opacity = originalOpacity;
                    this.originalElementOpacity.delete(marker as object);
                }
            }
        }
    }
}
