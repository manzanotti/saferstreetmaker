import * as L from 'leaflet';
import { createPolylineLayer, type EditablePolylineLayer } from './usePolylineLayer';
import { addPolylineToLayer, loadPolylineGeoJSON } from './polylineHelpers';
import { buildHistoryId } from './features/featureLookup';
import type { IMapLayer } from './IMapLayer';

const COLOUR = '#2222ff';
const WEIGHT = 5;

function addLine(
    latLngs: L.LatLng[],
    geoJsonLayer: L.GeoJSON,
    map: L.Map,
    selectForEdit: () => void,
    historyId?: string,
    name?: string
) {
    return addPolylineToLayer({
        points: latLngs,
        geoJsonLayer,
        map,
        layerId: 'MobilityLanes',
        polylineOpts: {
            color: COLOUR,
            weight: WEIGHT,
            opacity: 1,
            smoothFactor: 1,
            className: 'mobility-lane'
        },
        buttonId: 'mobility-lane',
        selectForEdit,
        popupKeepInView: false,
        historyId,
        name,
        iconSrc: new URL('../../img/bicycle-svgrepo-com.svg', import.meta.url).href
    });
}

export function createMobilityLaneLayer(map: L.Map): IMapLayer {
    let layer: EditablePolylineLayer;

    layer = createPolylineLayer(
        {
            id: 'MobilityLanes',
            title: 'Mobility Lanes',
            groupName: '',
            buttonId: 'mobility-lane',
            tooltip: 'Add mobility lanes to the map',
            toggleTitle: 'Toggle mobility lanes from the map',
            iconSrc: new URL('../../img/bicycle-svgrepo-com.svg', import.meta.url).href,
            createDrawingTool(m) {
                const tool = new L.Draw.Polyline(m, {
                    repeatMode: true,
                    color: COLOUR,
                    weight: WEIGHT,
                    opacity: 1,
                    smoothFactor: 1
                });
                tool.enable();
                return tool;
            },
            onDrawCreated(latLngs, geoJsonLayer, m) {
                return addLine(latLngs, geoJsonLayer, m, () => layer.selectForEdit());
            },
            buildIconEl() {
                const icon = document.createElement('i');
                icon.style.backgroundColor = COLOUR;
                return icon;
            }
        },
        map
    );

    layer.loadFromGeoJSON = (geoJson: any) => {
        loadPolylineGeoJSON(geoJson, (pts, historyId, name) =>
            addLine(pts, layer.getLayer(), map, () => layer.selectForEdit(), historyId, name)
        );
    };
    layer.loadFeature = (feature: any, historyId?: string) => {
        if (feature?.geometry?.type !== 'LineString') {
            return null;
        }
        const points = feature.geometry.coordinates.map(
            ([lng, lat]: [number, number]) => new L.LatLng(lat, lng)
        );
        const id = historyId ?? buildHistoryId('polyline');
        addLine(
            points,
            layer.getLayer(),
            map,
            () => layer.selectForEdit(),
            id,
            feature.properties?.name
        );
        return id;
    };

    return layer;
}
