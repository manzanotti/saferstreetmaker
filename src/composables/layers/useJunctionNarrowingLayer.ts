import * as L from 'leaflet';
import { isLinearRing } from '../../features/map/geoJsonCoordinates';
import type { IMapLayer } from './IMapLayer';
import { buildHistoryId } from './features/featureLookup';
import { addPolylineToLayer } from './polylineHelpers';
import { createPolylineLayer, type EditablePolylineLayer } from './usePolylineLayer';

const LAYER_ID = 'JunctionNarrowings';
const BUTTON_ID = 'junction-narrowing';
const COLOUR = '#000000';
const ICON_SRC = new URL('../../img/junction-narrowing.svg', import.meta.url).href;

function polygonPoints(feature: GeoJSON.Feature): L.LatLng[][] {
    if (
        feature.geometry?.type !== 'Polygon' ||
        feature.geometry.coordinates.length === 0 ||
        !feature.geometry.coordinates.every(isLinearRing)
    ) {
        throw new Error(`Layer "${LAYER_ID}" contains an invalid polygon feature.`);
    }

    return feature.geometry.coordinates.map((ring) =>
        ring.map(([lng, lat, altitude]) => new L.LatLng(lat, lng, altitude))
    );
}

export function createJunctionNarrowingLayer(map: L.Map): IMapLayer {
    let layer: EditablePolylineLayer;

    const addPolygon = (
        points: L.LatLng[] | L.LatLng[][],
        geoJsonLayer: L.GeoJSON,
        historyId?: string,
        name?: string
    ): L.Popup =>
        addPolylineToLayer({
            points,
            geoJsonLayer,
            map,
            layerId: LAYER_ID,
            kind: 'polygon',
            polylineOpts: {
                color: COLOUR,
                fillColor: COLOUR,
                fillOpacity: 1,
                weight: 2,
                opacity: 1,
                smoothFactor: 1,
                className: BUTTON_ID
            },
            buttonId: BUTTON_ID,
            selectForEdit: () => layer.selectForEdit(),
            historyId,
            name,
            iconSrc: ICON_SRC
        });

    layer = createPolylineLayer(
        {
            id: LAYER_ID,
            title: 'Junction Narrowings',
            groupName: '',
            buttonId: BUTTON_ID,
            tooltip: 'Add junction narrowings to the map',
            toggleTitle: 'Toggle junction narrowings from the map',
            kind: 'polygon',
            iconSrc: ICON_SRC,
            createDrawingTool(currentMap) {
                const tool = new L.Draw.Polygon(currentMap, {
                    repeatMode: true,
                    shapeOptions: {
                        color: COLOUR,
                        fillColor: COLOUR,
                        fillOpacity: 1,
                        weight: 2,
                        opacity: 1
                    }
                });
                tool.enable();
                return tool;
            },
            onDrawCreated(points, geoJsonLayer) {
                return addPolygon(points, geoJsonLayer);
            },
            buildIconEl() {
                const icon = document.createElement('i');
                icon.style.backgroundColor = COLOUR;
                return icon;
            }
        },
        map
    );

    layer.loadFromGeoJSON = (geoJson: GeoJSON.FeatureCollection): void => {
        if (!geoJson?.features) {
            throw new Error(`Layer "${LAYER_ID}" must contain a GeoJSON feature collection.`);
        }
        for (const feature of geoJson.features) {
            addPolygon(
                polygonPoints(feature),
                layer.getLayer(),
                feature.properties?.historyId,
                feature.properties?.name
            );
        }
    };

    layer.loadFeature = (feature: GeoJSON.Feature, historyId?: string): string | null => {
        if (feature.geometry?.type !== 'Polygon') {
            return null;
        }
        const id = historyId ?? buildHistoryId('polygon');
        addPolygon(polygonPoints(feature), layer.getLayer(), id, feature.properties?.name);
        return id;
    };

    return layer;
}
