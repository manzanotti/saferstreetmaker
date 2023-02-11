import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { EventTopics } from '../EventTopics';
import { IMapLayer } from "./IMapLayer";

export class LtnLayer implements IMapLayer {
    public static Id = 'LtnCells';
    public readonly id: string;
    public readonly title: string;
    public selected: boolean;
    private readonly _layer: L.GeoJSON;
    private readonly _layerColour = '#ff5e00';

    private _ltnTitle: string = '1';

    constructor() {
        this._layer = L.geoJSON();

        this.id = LtnLayer.Id;
        this.title = 'LTN Cells';
        this.selected = false;

        this.setupSubscribers();
    }

    private setupSubscribers = () => {
        PubSub.subscribe(EventTopics.layerSelected, (msg, selectedLayerId) => {
            if (selectedLayerId !== LtnLayer.Id) {
                this.deselectLayer();
            } else {
                this.selectLayer();
            }
        });

        PubSub.subscribe(EventTopics.deselected, (msg) => {
            if (this.selected) {
                this.deselectLayer();
            }
        });

        PubSub.subscribe(EventTopics.drawCreated, (msg, latLng: Array<L.LatLng>) => {
            if (this.selected) {
                this.addLtnCell(latLng, this._ltnTitle, this._layerColour);
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
            color: color || this._layerColour
        })
            .on('edit', (e) => {
                PubSub.publish(EventTopics.layerUpdated, LtnLayer.Id);
            });

        polygon['properties'] = {};
        polygon['properties'].label = label;

        const tooltip = polygon.bindTooltip(label,
            { permanent: true, direction: "center" }
        ).openTooltip()

        const popup = this.createPopup(polygon, tooltip, label);

        polygon.on('click', (e) => {
            this.onClick(e);

            popup.setLatLng(e.target.getBounds().getCenter());
            PubSub.publish(EventTopics.showPopup, popup);
        });

        this._layer.addLayer(polygon);
    };

    private createPopup = (polygon, tooltip, label): L.Popup => {
        const popup = L.popup({ minWidth: 30, keepInView: true });

        const controlList = document.createElement('ul');
        controlList.classList.add('popup-buttons');

        const labelControl = document.createElement('li');
        const labelElement = document.createElement('input');
        labelElement.type = 'text';
        labelElement.value = label;
        labelElement.classList.add('label-editor');
        labelElement.addEventListener('keyup', (e) => {
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
        deleteControl.addEventListener('click', (e) => {
            this.delete(polygon);
            PubSub.publish(EventTopics.closePopup, popup);
        });
        controlList.appendChild(deleteControl);

        popup.setContent(controlList);

        return popup;
    }

    private delete = (layer: L.Draw.Polygon) => {
        this._layer.removeLayer(layer);
        PubSub.publish(EventTopics.layerUpdated, LtnLayer.Id);
    }

    private onClick = (e) => {
        this.selectLayer();

        const polygon = e.target;
        polygon.editing.enable();
        PubSub.publish(EventTopics.layerSelected, LtnLayer.Id);
    };

    private selectLayer = () => {
        this.selected = true;
        this.setCursor();
    }

    private deselectLayer = () => {
        if (!this.selected) {
            return;
        }

        this._layer.eachLayer((layer: L.Draw.Polygon) => {
            layer.editing.disable();
        });

        this.removeCursor();
        this.selected = false;
    }

    getToolbarAction = (map: L.Map) => {
        const modalFilterAction = L['Toolbar2'].Action.extend({
            options: {
                toolbarIcon: {
                    html: '<div class="ltn-button">LTN</div>',
                    tooltip: 'Add LTN Cells to the map'
                }
            },

            addHooks: () => {
                if (this.selected) {
                    this.deselectLayer();
                    this.selected = false;
                    this.removeCursor();
                    PubSub.publish(EventTopics.deselected, LtnLayer.Id);
                    return;
                }

                this.selected = true;

                const options = {
                    color: this._layerColour
                };
                const polygon = new L['Draw'].Polygon(map, options);

                polygon.enable();
                this.setCursor();

                PubSub.publish(EventTopics.layerSelected, LtnLayer.Id);
            }
        });

        return modalFilterAction;
    };

    getLegendEntry = () => {
        const icon = document.createElement('i');
        icon.style.backgroundColor = this._layerColour;

        const text = document.createElement('span');
        text.textContent = this.title;

        const br = document.createElement('br');

        return [icon, text, br];
    }

    private setCursor = () => {
        document.getElementById('map')?.classList.remove('leaflet-grab');
        document.getElementById('map')?.classList.add('ltn-cell');
    };

    private removeCursor = () => {
        document.getElementById('map')?.classList.remove('ltn-cell');
        document.getElementById('map')?.classList.add('leaflet-grab');
    };

    loadFromGeoJSON = (geoJson: L.GeoJSON) => {
        if (geoJson) {
            const ltnCells = geoJson['features'];
            ltnCells.forEach((ltnCell) => {
                const points = new Array<L.LatLng>();
                const coordinates = ltnCell.geometry.coordinates;
                const polygonCoordinates = coordinates[0];
                polygonCoordinates.forEach((coordinate) => {
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
    };
}
