/**
 * Factory for the 6 simple polyline layers:
 * TramLine, BusLane, CarFreeStreet, SchoolStreet, OneWayStreet
 * (no drawing-tool re-init after draw:created)
 */
import * as L from 'leaflet';
import { createPolylineLayer, type EditablePolylineLayer } from './usePolylineLayer';
import { addPolylineToLayer, loadPolylineGeoJSON } from './polylineHelpers';
import type { IMapLayer } from './IMapLayer';
import { buildHistoryId } from './layerUtils';

interface SimplePolylineConfig {
    id: string;
    title: string;
    groupName?: string;
    isFirst?: boolean;
    buttonId: string;
    tooltip: string;
    toggleTitle: string;
    colour: string;
    weight: number;
    iconSrc?: string;
    iconExtra?: (icon: HTMLElement) => void;
    arrowheads?: object;
}

function createSimplePolylineLayer(cfg: SimplePolylineConfig, map: L.Map): IMapLayer {
    let layer: EditablePolylineLayer;

    const addLine = (
        latLngs: L.LatLng[],
        geoJsonLayer: L.GeoJSON,
        historyId?: string,
        name?: string
    ) => {
        addPolylineToLayer({
            points: latLngs,
            geoJsonLayer,
            map,
            layerId: cfg.id,
            polylineOpts: {
                color: cfg.colour,
                weight: cfg.weight,
                opacity: 1,
                smoothFactor: 1,
                className: cfg.buttonId
            },
            buttonId: cfg.buttonId,
            selectForEdit: () => layer.selectForEdit(),
            historyId,
            name,
            iconSrc: cfg.iconSrc,
            arrowheads: cfg.arrowheads
        });
    };

    layer = createPolylineLayer(
        {
            id: cfg.id,
            title: cfg.title,
            groupName: cfg.groupName ?? '',
            buttonId: cfg.buttonId,
            tooltip: cfg.tooltip,
            toggleTitle: cfg.toggleTitle,
            isFirst: cfg.isFirst,
            iconSrc: cfg.iconSrc,
            createDrawingTool(m) {
                const tool = new L.Draw.Polyline(m, {
                    color: cfg.colour,
                    weight: cfg.weight,
                    opacity: 1,
                    smoothFactor: 1
                });
                tool.enable();
                return tool;
            },
            onDrawCreated(latLngs, geoJsonLayer) {
                addLine(latLngs, geoJsonLayer);
            },
            buildIconEl() {
                const icon = document.createElement('i');
                icon.style.backgroundColor = cfg.colour;
                if (cfg.iconExtra) {
                    cfg.iconExtra(icon);
                }
                return icon;
            }
        },
        map
    );

    layer.loadFromGeoJSON = (geoJson: any) => {
        loadPolylineGeoJSON(geoJson, (pts, historyId, name) =>
            addLine(pts, layer.getLayer(), historyId, name)
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
        addLine(points, layer.getLayer(), id, feature.properties?.name);
        return id;
    };

    return layer;
}

export function createTramLineLayer(map: L.Map): IMapLayer {
    return createSimplePolylineLayer(
        {
            id: 'TramLines',
            title: 'Tram Lines',
            groupName: 'tram-and-bus-lanes',
            buttonId: 'tram-line',
            tooltip: 'Add tram lines to the map',
            toggleTitle: 'Toggle tram lines from the map',
            colour: '#ff5e00',
            weight: 5,
            iconSrc: new URL('../../img/tram-svgrepo-com.svg', import.meta.url).href,
            isFirst: true
        },
        map
    );
}

export function createBusLaneLayer(map: L.Map): IMapLayer {
    const iconSrc = new URL('../../img/bus-lane.svg', import.meta.url).href;
    return createSimplePolylineLayer(
        {
            id: 'BusLanes',
            title: 'Bus Lanes',
            groupName: 'tram-and-bus-lanes',
            buttonId: 'bus-lane',
            tooltip: 'Add bus lanes to the map',
            toggleTitle: 'Toggle bus lanes from the map',
            colour: '#b91c1c',
            weight: 5,
            iconSrc,
            iconExtra: (icon) => {
                icon.style.backgroundImage = `url(${iconSrc})`;
                icon.style.backgroundSize = '18px 18px';
                icon.style.backgroundRepeat = 'no-repeat';
            }
        },
        map
    );
}

export function createCarFreeStreetLayer(map: L.Map): IMapLayer {
    return createSimplePolylineLayer(
        {
            id: 'CarFreeStreets',
            title: 'Car-free Streets',
            buttonId: 'car-free-street',
            tooltip: 'Add car-free streets to the map',
            toggleTitle: 'Toggle car-free streets from the map',
            colour: '#00bb00',
            weight: 10,
            iconSrc: new URL('../../img/ban-on-driving-147248.svg', import.meta.url).href
        },
        map
    );
}

export function createSchoolStreetLayer(map: L.Map): IMapLayer {
    return createSimplePolylineLayer(
        {
            id: 'SchoolStreet',
            title: 'School Streets',
            buttonId: 'school-street',
            tooltip: 'Add school streets to the map',
            toggleTitle: 'Toggle school streets from the map',
            colour: '#E6EA09',
            weight: 5,
            iconSrc: new URL('../../img/school-street.svg', import.meta.url).href
        },
        map
    );
}

export function createOneWayStreetLayer(map: L.Map): IMapLayer {
    return createSimplePolylineLayer(
        {
            id: 'OneWayStreets',
            title: 'One-way Streets',
            buttonId: 'one-way-street',
            tooltip: 'Add one-way streets to the map',
            toggleTitle: 'Toggle one-way streets from the map',
            colour: '#000000',
            weight: 2,
            iconSrc: new URL('../../img/one-way-street.svg', import.meta.url).href,
            arrowheads: { frequency: '50px', size: '15px', yawn: 40 }
        },
        map
    );
}
