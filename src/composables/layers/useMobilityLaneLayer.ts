import * as L from 'leaflet';
import { createPolylineLayer, type EditablePolylineLayer } from './usePolylineLayer';
import { addPolylineToLayer, loadPolylineGeoJSON } from './polylineHelpers';
import { buildHistoryId } from './layerUtils';
import type { IMapLayer } from './IMapLayer';

const COLOUR = '#2222ff';
const WEIGHT = 5;

function addLine(
    latLngs: L.LatLng[],
    geoJsonLayer: L.GeoJSON,
    map: L.Map,
    selectForEdit: () => void,
    reinit?: (m: L.Map) => void,
    historyId?: string,
    name?: string
) {
    addPolylineToLayer({
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
        reinitDrawing: reinit,
        historyId,
        name,
        iconSrc: new URL('../../img/bicycle-svgrepo-com.svg', import.meta.url).href
    });
}

export function createMobilityLaneLayer(map: L.Map): IMapLayer {
    let _drawingTool: any = null;
    let layer: EditablePolylineLayer;

    const reinit = (m: L.Map) => {
        _drawingTool = new L.Draw.Polyline(m, {
            color: COLOUR,
            weight: WEIGHT,
            opacity: 1,
            smoothFactor: 1
        });
        _drawingTool.enable();
    };

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
                _drawingTool = new L.Draw.Polyline(m, {
                    color: COLOUR,
                    weight: WEIGHT,
                    opacity: 1,
                    smoothFactor: 1
                });
                _drawingTool.enable();
                return _drawingTool;
            },
            onDrawCreated(latLngs, geoJsonLayer, m) {
                addLine(latLngs, geoJsonLayer, m, () => layer.selectForEdit(), reinit);
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
            addLine(
                pts,
                layer.getLayer(),
                map,
                () => layer.selectForEdit(),
                undefined,
                historyId,
                name
            )
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
            undefined,
            id,
            feature.properties?.name
        );
        return id;
    };

    return layer;
}
