import type * as GeoJSON from 'geojson';
import type { GroupMember, GroupVersion } from '../../models/Group';
import type { IMapLayer } from '../../composables/layers/IMapLayer';
import { buildHistoryId } from '../../composables/layers/layerUtils';

export interface GroupVersionCloneOptions {
    getLayer: (layerId: string) => IMapLayer | undefined;
    findFeature: (layer: IMapLayer, historyId: string) => GeoJSON.Feature | null;
}

export class GroupVersionFeatureCloner {
    constructor(private readonly options: GroupVersionCloneOptions) {}

    clone(version: GroupVersion): GroupVersion {
        const members: GroupMember[] = [];
        for (const member of version.members) {
            const layer = this.options.getLayer(member.layerId);
            const feature = layer ? this.options.findFeature(layer, member.historyId) : null;
            if (!layer || !feature || !layer.loadFeature) {
                continue;
            }

            const historyId = buildHistoryId(`group-version-${member.layerId}`);
            const importedId = layer.loadFeature(feature, historyId);
            if (importedId) {
                members.push({ layerId: member.layerId, historyId: importedId });
            }
        }

        return {
            id: buildHistoryId('group-version'),
            name: version.name,
            members
        };
    }
}
