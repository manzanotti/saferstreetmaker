import type { Ref } from 'vue';
import { ref } from 'vue';
import { useSettingsStore } from '../stores/settingsStore';
import { useMapStore } from '../stores/mapStore';
import { useGroupStore } from '../stores/groupStore';
import { useImportedLayerStore } from '../stores/importedLayerStore';
import { getFileManager } from './useMapManager';
import { getGroupVersions } from '../features/groups/groupVersions';
import type { Group } from '../models/Group';
import type { IMapLayer } from './layers/IMapLayer';

export function useSharingGenerator(
    width: Ref<number | null>,
    height: Ref<number | null>,
    hideToolbar: Ref<boolean>,
    shareScopeGroup: Ref<Group | null>
) {
    const settingsStore = useSettingsStore();
    const mapStore = useMapStore();
    const groupStore = useGroupStore();
    const importedLayerStore = useImportedLayerStore();
    const showCopiedMessage = ref(false);

    function createShare(scope: 'all' | 'group', selectedGroup: Group | undefined) {
        if (
            width.value === null ||
            height.value === null ||
            width.value <= 0 ||
            height.value <= 0
        ) {
            return;
        }

        const groupForShare = shareScopeGroup.value ?? selectedGroup;
        const layers =
            scope === 'group' && groupForShare
                ? getGroupLayers(groupForShare)
                : mapStore.toLayers();
        const importedLayersForShare =
            scope === 'group'
                ? []
                : importedLayerStore.layers.filter((layer) => layer.visible !== false);
        const mapHash = getFileManager().saveMapToHash(
            settingsStore.toSettings(),
            layers,
            scope === 'group' && groupForShare ? [groupForShare] : groupStore.groups,
            importedLayersForShare
        );
        const baseUrl = window.location.origin + window.location.pathname;
        const params = new URLSearchParams({ 'hide-toolbar': String(hideToolbar.value) });
        if (groupForShare) {
            const versions = getGroupVersions(groupForShare);
            const activeVersionId = groupStore.activeVersionIds[groupForShare.id];
            const versionIndex = versions.findIndex((version) => version.id === activeVersionId);
            params.set('group', groupForShare.id);
            if (versionIndex >= 0) {
                params.set('version', String(versionIndex + 1));
            }
        }
        const html = `<iframe src="${baseUrl}?${params.toString()}#${mapHash}" width="${width.value}" height="${height.value}" title="Safer Street Maker map"></iframe>`;

        if (!navigator.clipboard) {
            showCopiedMessage.value = false;
            return;
        }

        navigator.clipboard
            .writeText(html)
            .then(() => {
                shareScopeGroup.value = null;
                showCopiedMessage.value = true;
            })
            .catch((err) => {
                showCopiedMessage.value = false;
                console.warn('Clipboard write failed:', err);
            });
    }

    function getGroupLayers(group: Group): Map<string, IMapLayer> {
        const memberKeys = new Set(
            getGroupVersions(group).flatMap((version) =>
                version.members.map((member) => `${member.layerId}:${member.historyId}`)
            )
        );
        const layers = new Map<string, IMapLayer>();
        mapStore.toLayers().forEach((layer, layerId) => {
            const geoJson = layer.toGeoJSON() as unknown as GeoJSON.FeatureCollection;
            layers.set(layerId, {
                ...layer,
                toGeoJSON: () => ({
                    ...geoJson,
                    features: (geoJson.features ?? []).filter((feature) =>
                        memberKeys.has(`${layerId}:${String(feature.properties?.historyId ?? '')}`)
                    )
                })
            });
        });
        return layers;
    }

    return { showCopiedMessage, createShare };
}
