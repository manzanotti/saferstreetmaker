import { computed, ref } from 'vue';
import { useMapStore } from '../../stores/mapStore';
import { getImageExportValidationError } from '../../features/export/mapImageExport';

export type ExportFormat = 'image' | 'html' | 'url';

export function useSharingExportOptions() {
    const mapStore = useMapStore();
    const mapSize = mapStore.map?.getSize();
    const width = ref<number | null>(mapSize ? Math.round(mapSize.x) : null);
    const height = ref<number | null>(mapSize ? Math.round(mapSize.y) : null);
    const exportFormat = ref<ExportFormat>('html');
    const exportValidationError = computed(() =>
        exportFormat.value === 'image'
            ? getImageExportValidationError(width.value, height.value)
            : null
    );

    function hasEmbedDimensions() {
        return width.value !== null && height.value !== null && width.value > 0 && height.value > 0;
    }

    return { width, height, exportFormat, exportValidationError, hasEmbedDimensions };
}
