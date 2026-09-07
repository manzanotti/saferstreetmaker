import { computed, ref, toRaw, watch } from 'vue';
import type { ImportedGeoJsonLayer } from '../models/ImportedGeoJsonLayer';
import {
    createImportedLayerId,
    getNamePropertyOptions,
    getPropertyPreview,
    parseGeoJson,
    retainNameProperty,
    type GeoJsonPropertyPreview
} from '../features/map/importedGeoJson';

type GeoJsonSource = 'file' | 'url';

export function useGeoJsonLayerImport(existingNames: () => string[]) {
    const source = ref<GeoJsonSource>('file');
    const url = ref('');
    const layerName = ref('');
    const nameProperty = ref<string | null>(null);
    const parsedGeoJson = ref<GeoJSON.FeatureCollection | null>(null);
    const propertyPreview = ref<GeoJsonPropertyPreview[]>([]);
    const namePropertyOptions = ref<string[]>([]);
    const error = ref('');
    const loading = ref(false);
    let urlRequestId = 0;
    let fileRequestId = 0;

    const dialogInputId = computed(() =>
        source.value === 'file' ? 'geojson-file' : 'geojson-url'
    );

    function resetError() {
        error.value = '';
    }

    function invalidateUrlRequest() {
        urlRequestId += 1;
        loading.value = false;
    }

    function resetParsedImport() {
        invalidateUrlRequest();
        fileRequestId += 1;
        parsedGeoJson.value = null;
        propertyPreview.value = [];
        namePropertyOptions.value = [];
        nameProperty.value = null;
        layerName.value = '';
    }

    watch(source, resetParsedImport);
    watch(url, resetParsedImport);

    function setParsedGeoJson(value: unknown, sourceName: string) {
        const featureCollection = parseGeoJson(value);
        parsedGeoJson.value = featureCollection;
        propertyPreview.value = getPropertyPreview(featureCollection);
        namePropertyOptions.value = getNamePropertyOptions(featureCollection);
        nameProperty.value = null;
        layerName.value = sourceName.replace(/\.(geojson|json)$/i, '');
    }

    async function loadFile(file: File | null) {
        resetError();
        const requestId = ++fileRequestId;
        const selectedSource = source.value;
        parsedGeoJson.value = null;
        propertyPreview.value = [];
        namePropertyOptions.value = [];
        if (!file) {
            return;
        }
        try {
            const value = JSON.parse(await file.text());
            if (requestId !== fileRequestId || source.value !== selectedSource) {
                return;
            }
            setParsedGeoJson(value, file.name);
        } catch (e: unknown) {
            if (requestId === fileRequestId && source.value === selectedSource) {
                error.value =
                    e instanceof SyntaxError
                        ? 'The file is not valid JSON.'
                        : String((e as Error).message ?? e);
            }
        }
    }

    async function loadFromUrl() {
        if (loading.value) {
            return;
        }
        resetError();
        if (!url.value.trim()) {
            error.value = 'Enter a GeoJSON URL.';
            return;
        }
        const requestedUrl = url.value.trim();
        const requestId = ++urlRequestId;
        loading.value = true;
        parsedGeoJson.value = null;
        propertyPreview.value = [];
        try {
            const response = await fetch(requestedUrl);
            if (!response.ok) {
                throw new Error(`The URL returned ${response.status} ${response.statusText}.`);
            }
            const value = await response.json();
            if (
                requestId !== urlRequestId ||
                source.value !== 'url' ||
                url.value.trim() !== requestedUrl
            ) {
                return;
            }
            const sourceUrl = new URL(requestedUrl, window.location.href);
            const encodedSourceName = sourceUrl.pathname.split('/').pop() || 'GeoJSON layer';
            let sourceName = encodedSourceName;
            try {
                sourceName = decodeURIComponent(encodedSourceName);
            } catch {
                // Keep the encoded path segment when it is not valid URI encoding.
            }
            setParsedGeoJson(value, sourceName);
        } catch (e: unknown) {
            if (requestId === urlRequestId) {
                error.value = `Could not load GeoJSON. ${String((e as Error).message ?? e)} Check that the URL allows browser CORS requests.`;
            }
        } finally {
            if (requestId === urlRequestId) {
                loading.value = false;
            }
        }
    }

    function buildLayer(): ImportedGeoJsonLayer | null {
        if (!parsedGeoJson.value) {
            error.value = 'Choose a file or load a URL before adding a layer.';
            return null;
        }
        const trimmedName = layerName.value.trim();
        if (!trimmedName) {
            error.value = 'Enter a name for this layer.';
            return null;
        }
        if (existingNames().includes(trimmedName)) {
            error.value = 'A layer with this name already exists.';
            return null;
        }
        return {
            id: createImportedLayerId(),
            name: trimmedName,
            nameProperty: nameProperty.value,
            visible: true,
            featureCollection: retainNameProperty(toRaw(parsedGeoJson.value), nameProperty.value)
        };
    }

    return {
        source,
        url,
        layerName,
        nameProperty,
        parsedGeoJson,
        propertyPreview,
        namePropertyOptions,
        error,
        loading,
        dialogInputId,
        buildLayer,
        loadFile,
        loadFromUrl
    };
}
