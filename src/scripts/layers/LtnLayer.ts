import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { ToolbarButton } from '../Controls/ToolbarButton';
import { EventTopics } from '../EventTopics';
import { IMapLayer } from "./IMapLayer";
import {
    buildLegendEntry,
    buildToolbarButton,
    deselectPolylineLayer,
    selectLayer,
} from './LayerHelpers';

export class LtnLayer implements IMapLayer {
    public static Id = 'LtnCells';

    public readonly id: string = LtnLayer.Id;
    public readonly title: string = 'LTN Cells';
    public readonly groupName: string = '';
    public selected: boolean = false;
    public visible: boolean = false;

    private readonly _prefix = 'ltn';
    private readonly _cursorCss = 'ltn-cell';
    private readonly _layer: L.GeoJSON;
    private readonly _layerColour = '#cc00cc';
    private _ltnTitle: string = '1';
    private _otherLayerSelected: boolean = false;

    constructor() {
        this._layer = new L.GeoJSON(undefined, { pane: 'ltns' });
        this.setupSubscribers();
    }

    getToolbarButton = (): ToolbarButton =>
        buildToolbarButton({
            id: this._prefix,
            tooltip: 'Add LTNs to the map',
            groupName: this.groupName,
            action: this.onButtonClick,
            selected: this.selected,
            text: 'LTN',
        });

    getLegendEntry = (): HTMLElement => {
        const icon = document.createElement('i');
        icon.style.backgroundColor = this._layerColour;
        return buildLegendEntry({
            layerId: this.id,
            title: this.title,
            toggleTitle: 'Toggle LTNs from the map',
            iconEl: icon,
            visibilityState: this,
        });
    };

    loadFromGeoJSON = (geoJson: L.GeoJSON) => {
        if (geoJson) {
            const ltnCells = geoJson['features'];
            ltnCells.forEach((ltnCell) => {
                const points = new Array<L.LatLng>();
                const coordinates = ltnCell.geometry.coordinates;
                const polygonCoordinates = coordinates[0];
                polygonCoordinates.forEach((coordinate: Array<number>) => {
                    points.push(new L.LatLng(coordinate[1], coordinate[0]));
                });

                const properties = ltnCell.properties;

                this.addLtnCell(points, properties.label, properties.color);
            });
        }
    };

    getLayer = (): L.GeoJSON => {
        return this._layer;
    };

    toGeoJSON = (): {} => {
        let json = {
            type: 'FeatureCollection',
            features: new Array()
        };
        this._layer.eachLayer((layer) => {
            let layerJson = (layer as L.Polygon).toGeoJSON();

            const properties = layer['properties'];
            layerJson.properties.label = properties.label;
            layerJson.properties.color = layer['options'].color;

            json.features.push(layerJson);
        });

        return json;
    }

    clearLayer = (): void => {
        this._layer.clearLayers();
        this.visible = false;
    };

    private setupSubscribers = () => {
        PubSub.subscribe(EventTopics.layerSelected, (msg, selectedLayerId) => {
            if (selectedLayerId !== LtnLayer.Id) {
                deselectPolylineLayer(this, this._cursorCss, this._layer);
                this._otherLayerSelected = true;
            } else {
                selectLayer(this, this._cursorCss);
                this._otherLayerSelected = false;
            }
        });

        PubSub.subscribe(EventTopics.layerDeselected, () => {
            deselectPolylineLayer(this, this._cursorCss, this._layer);
            this._otherLayerSelected = false;
        });

        PubSub.subscribe(EventTopics.drawCreated, (msg, data: { latLngs: Array<L.LatLng>, map: L.Map }) => {
            if (this.selected) {
                this.addLtnCell(data.latLngs, this._ltnTitle, this._layerColour);
                PubSub.publish(EventTopics.layerUpdated, LtnLayer.Id);
            }
        });

        PubSub.subscribe(EventTopics.mapZoomChanged, (msg, zoomLevel: number) => {
            this._layer.eachLayer((layer) => {
                if (zoomLevel < 14) {
                    layer.closeTooltip();
                } else {
                    layer.openTooltip();
                }
            });
        });
    };

    private addLtnCell = (points: Array<L.LatLng>, label: string, color: string) => {
        const polygon = new L.Polygon(points, {
            color: color || this._layerColour,
            fillOpacity: 0.2,
            weight: 5,
            pane: 'ltns',
            className: 'ltn-cell',
        }).on('edit', () => {
            PubSub.publish(EventTopics.layerUpdated, LtnLayer.Id);
        });

        polygon['properties'] = { label };

        const tooltip = polygon.bindTooltip(label,
            { permanent: true, direction: "center" }
        ).openTooltip();

        const popup = this.createPopup(polygon, tooltip, label);

        polygon.on('click', (e) => {
            if (!this._otherLayerSelected) {
                selectLayer(this, this._cursorCss);
                e.target.editing.enable();
                PubSub.publish(EventTopics.layerSelected, LtnLayer.Id);
                popup.setLatLng(e.target.getBounds().getCenter());
                PubSub.publish(EventTopics.showPopup, popup);
            }
        });

        this._layer.addLayer(polygon);
    };

    private createPopup = (polygon: L.Polygon, tooltip: L.Layer, label: string): L.Popup => {
        const popup = L.popup({ minWidth: 30, keepInView: true });

        const controlList = document.createElement('ul');
        controlList.classList.add('popup-buttons');

        const labelControl = document.createElement('li');
        const labelElement = document.createElement('input');
        labelElement.type = 'text';
        labelElement.value = label;
        labelElement.classList.add('label-editor');
        labelElement.addEventListener('keyup', () => {
            const text = labelElement.value;
            tooltip.setTooltipContent(text);
            polygon['properties'].label = text;

            if (text.length == 0) {
                polygon.closeTooltip();
            } else {
                polygon.openTooltip();
            }

            PubSub.publish(EventTopics.layerUpdated, LtnLayer.Id);
        });
        labelControl.appendChild(labelElement);
        controlList.appendChild(labelControl);

        const deleteControl = document.createElement('li');
        deleteControl.classList.add('delete-button');
        deleteControl.addEventListener('click', () => {
            this._layer.removeLayer(polygon);
            PubSub.publish(EventTopics.layerUpdated, LtnLayer.Id);
            PubSub.publish(EventTopics.closePopup, popup);
        });
        controlList.appendChild(deleteControl);

        popup.setContent(controlList);

        return popup;
    };

    private onButtonClick = (event: Event, map: L.Map) => {
        if (this.selected) {
            deselectPolylineLayer(this, this._cursorCss, this._layer);
            PubSub.publish(EventTopics.layerDeselected, LtnLayer.Id);
            return;
        }
        new L['Draw'].Polygon(map, { color: this._layerColour }).enable();
        selectLayer(this, this._cursorCss);
        PubSub.publish(EventTopics.layerSelected, LtnLayer.Id);
    };
}
