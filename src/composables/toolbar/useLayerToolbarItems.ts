import { computed, type Ref } from 'vue';
import type { ToolbarButton } from '../../models/ToolbarButton';
import { useMapStore } from '../../stores/mapStore';
import { useSettingsStore } from '../../stores/settingsStore';

export interface GroupToolbarItem {
    type: 'group';
    parent: ToolbarButton;
    sub: ToolbarButton[];
    groupName: string;
}

export interface SingleToolbarItem {
    type: 'single';
    button: ToolbarButton;
}

export type LayerToolbarItem = GroupToolbarItem | SingleToolbarItem;

export function useLayerToolbarItems(lastSelectedByGroup: Ref<Record<string, string>>) {
    const mapStore = useMapStore();
    const settingsStore = useSettingsStore();

    const layerItems = computed<LayerToolbarItem[]>(() => {
        if (settingsStore.readOnly) {
            return [];
        }

        const allButtons = mapStore.layers
            .filter((layer) => settingsStore.activeLayers.includes(layer.id))
            .map((layer) => layer.getToolbarButton());

        const handledGroups = new Set<string>();
        const items: LayerToolbarItem[] = [];

        for (const button of allButtons) {
            if (!button.groupName) {
                items.push({ type: 'single', button });
                continue;
            }

            if (handledGroups.has(button.groupName)) {
                continue;
            }
            handledGroups.add(button.groupName);

            const groupButtons = allButtons.filter((item) => item.groupName === button.groupName);
            if (groupButtons.length === 1) {
                items.push({ type: 'single', button: groupButtons[0] });
                continue;
            }

            const anchor = groupButtons.find((item) => item.isFirst) ?? groupButtons[0];
            const lastId = lastSelectedByGroup.value[button.groupName];
            const active =
                groupButtons.find((item) => item.id === mapStore.drawLayerId) ??
                groupButtons.find((item) => item.id === lastId) ??
                anchor;
            const sub = groupButtons.filter((item) => item.id !== active.id);

            items.push({ type: 'group', parent: active, sub, groupName: button.groupName });
        }

        return items;
    });

    return { layerItems };
}
