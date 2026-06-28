import * as L from 'leaflet';
import { createPolylineLayer, type EditablePolylineLayer } from './usePolylineLayer';
import { addPolylineToLayer, loadPolylineGeoJSON } from './polylineHelpers';
import type { IMapLayer } from './IMapLayer';

const COLOUR = '#2222ff';
const WEIGHT = 5;

function addLine(
    latLngs: L.LatLng[],
    geoJsonLayer: L.GeoJSON,
    map: L.Map,
    selectForEdit: () => void,
    reinit?: (m: L.Map) => void,
    historyId?: string
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
        historyId
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
        loadPolylineGeoJSON(geoJson, (pts, historyId) =>
            addLine(pts, layer.getLayer(), map, () => layer.selectForEdit(), undefined, historyId)
        );
    };

    return layer;
}
