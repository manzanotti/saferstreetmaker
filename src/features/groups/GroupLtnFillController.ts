import type * as L from 'leaflet';
import type { Group } from '../../models/Group';
import { getActiveVersion } from './groupVersions';
import { normalizeGroupColour } from './groupColours';

const PATTERN_PREFIX = 'ssm-ltn-stripes-';
const STRIPE_WIDTH = 12;

export type LtnFillResolution =
    | { kind: 'fallback'; fillColor: string; colors: [] }
    | { kind: 'solid'; fillColor: string; colors: [string] }
    | { kind: 'pattern'; fillColor: string; colors: string[] };

export function resolveLtnFill(groupColors: string[], fallbackColor: string): LtnFillResolution {
    const colors = [
        ...new Set(
            groupColors
                .map((color) => normalizeGroupColour(color))
                .filter((color): color is string => color !== null)
        )
    ];
    if (colors.length === 0) {
        return { kind: 'fallback', fillColor: fallbackColor, colors: [] };
    }
    if (colors.length === 1) {
        return { kind: 'solid', fillColor: colors[0], colors: [colors[0]] };
    }
    return { kind: 'pattern', fillColor: '', colors };
}

interface GroupLtnFillControllerOptions {
    getGroups: () => Group[];
    getHiddenGroupIds: () => Set<string>;
    getActiveVersionIds: () => Record<string, string>;
    getLayer: () => L.LayerGroup | null;
}

type StyledPolygon = L.Layer & {
    options?: L.PathOptions;
    properties?: { historyId?: string };
    getElement?: () => SVGElement | undefined;
    setStyle?: (style: L.PathOptions) => void;
};

class SvgPatternRegistry {
    private readonly svgs = new Set<SVGSVGElement>();

    apply(svg: SVGSVGElement, colors: string[]): string {
        this.svgs.add(svg);
        const id = `${PATTERN_PREFIX}${colors.map((color) => color.slice(1)).join('-')}`;
        let defs = svg.querySelector<SVGDefsElement>(`defs[data-ssm-ltn-defs="true"]`);
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            defs.setAttribute('data-ssm-ltn-defs', 'true');
            svg.insertBefore(defs, svg.firstChild);
        }

        let pattern = defs.querySelector<SVGPatternElement>(`#${id}`);
        if (!pattern) {
            pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
            pattern.id = id;
            pattern.setAttribute('data-ssm-ltn-pattern', 'true');
            pattern.setAttribute('patternUnits', 'userSpaceOnUse');
            pattern.setAttribute('width', String(STRIPE_WIDTH * colors.length));
            pattern.setAttribute('height', String(STRIPE_WIDTH));
            pattern.setAttribute('patternTransform', 'rotate(45)');
            colors.forEach((color, index) => {
                const stripe = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                stripe.setAttribute('x', String(index * STRIPE_WIDTH));
                stripe.setAttribute('width', String(STRIPE_WIDTH));
                stripe.setAttribute('height', String(STRIPE_WIDTH));
                stripe.setAttribute('fill', color);
                pattern!.appendChild(stripe);
            });
            defs.appendChild(pattern);
        }

        return `url(#${id})`;
    }

    cleanup(activePatternIds: Set<string>): void {
        for (const svg of this.svgs) {
            svg.querySelectorAll<SVGPatternElement>('pattern[data-ssm-ltn-pattern="true"]').forEach(
                (pattern) => {
                    if (!activePatternIds.has(pattern.id)) {
                        pattern.remove();
                    }
                }
            );
        }
    }
}

export class GroupLtnFillController {
    private readonly patterns = new SvgPatternRegistry();

    constructor(private readonly options: GroupLtnFillControllerOptions) {}

    recompute(): void {
        const memberColors = this.getMemberColors();
        const activePatternIds = new Set<string>();
        const layer = this.options.getLayer();
        if (!layer || typeof (layer as L.LayerGroup).eachLayer !== 'function') {
            return;
        }
        layer?.eachLayer((rawMarker) => {
            const marker = rawMarker as StyledPolygon;
            if (typeof marker.setStyle !== 'function') {
                return;
            }

            const fallbackColor = marker.options?.color ?? '#cc00cc';
            const resolution = resolveLtnFill(
                memberColors.get(marker.properties?.historyId ?? '') ?? [],
                fallbackColor
            );
            let fillColor = resolution.fillColor;
            if (resolution.kind === 'pattern') {
                const element = marker.getElement?.();
                const svg = element?.ownerSVGElement;
                if (svg) {
                    fillColor = this.patterns.apply(svg, resolution.colors);
                    const patternId = fillColor.slice(5, -1);
                    activePatternIds.add(patternId);
                } else {
                    fillColor = resolution.colors[0];
                }
            }
            marker.setStyle({ fillColor });
            const element = marker.getElement?.();
            if (element) {
                element.setAttribute('stroke', fillColor);
            }
        });
        this.patterns.cleanup(activePatternIds);
    }

    private getMemberColors(): Map<string, string[]> {
        const colorsByMember = new Map<string, string[]>();
        const hiddenGroupIds = this.options.getHiddenGroupIds();
        const activeVersionIds = this.options.getActiveVersionIds();

        for (const group of this.options.getGroups()) {
            const color = group.color ? normalizeGroupColour(group.color) : null;
            if (hiddenGroupIds.has(group.id) || !color) {
                continue;
            }
            const activeVersion = getActiveVersion(group, activeVersionIds[group.id]);
            for (const member of activeVersion.members) {
                if (member.layerId !== 'LtnCells') {
                    continue;
                }
                const colors = colorsByMember.get(member.historyId) ?? [];
                colors.push(color);
                colorsByMember.set(member.historyId, colors);
            }
        }
        return colorsByMember;
    }
}
