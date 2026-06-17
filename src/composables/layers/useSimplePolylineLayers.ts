/**
 * Factory for the 4 simple polyline layers:
 * TramLine, CarFreeStreet, SchoolStreet, OneWayStreet
 * (no drawing-tool re-init after draw:created)
 */
import * as L from 'leaflet';
import { createPolylineLayer } from './usePolylineLayer';
import { addPolylineToLayer, loadPolylineGeoJSON } from './polylineHelpers';
import type { IMapLayer } from './IMapLayer';

interface SimplePolylineConfig {
  id: string;
  title: string;
  buttonId: string;
  tooltip: string;
  toggleTitle: string;
  colour: string;
  weight: number;
  iconExtra?: (icon: HTMLElement) => void;
  arrowheads?: object;
}

function createSimplePolylineLayer(cfg: SimplePolylineConfig, map: L.Map): IMapLayer {
  const addLine = (latLngs: L.LatLng[], geoJsonLayer: L.GeoJSON) => {
    addPolylineToLayer({
      points: latLngs,
      geoJsonLayer,
      map,
      polylineOpts: { color: cfg.colour, weight: cfg.weight, opacity: 1, smoothFactor: 1 },
      buttonId: cfg.buttonId,
      arrowheads: cfg.arrowheads,
    });
  };

  const layer = createPolylineLayer(
    {
      id: cfg.id,
      title: cfg.title,
      groupName: '',
      buttonId: cfg.buttonId,
      tooltip: cfg.tooltip,
      toggleTitle: cfg.toggleTitle,
      createDrawingTool(m) {
        const tool = new L.Draw.Polyline(m, {
          color: cfg.colour,
          weight: cfg.weight,
          opacity: 1,
          smoothFactor: 1,
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
        if (cfg.iconExtra) cfg.iconExtra(icon);
        return icon;
      },
    },
    map,
  );

  layer.loadFromGeoJSON = (geoJson: any) => {
    loadPolylineGeoJSON(geoJson, (pts) => addLine(pts, layer.getLayer()));
  };

  return layer;
}

export function createTramLineLayer(map: L.Map): IMapLayer {
  return createSimplePolylineLayer(
    {
      id: 'TramLines',
      title: 'Tram Lines',
      buttonId: 'tram-line',
      tooltip: 'Add tram lines to the map',
      toggleTitle: 'Toggle tram lines from the map',
      colour: '#ff5e00',
      weight: 5,
    },
    map,
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
    },
    map,
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
    },
    map,
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
      arrowheads: { frequency: '50px', size: '15px', yawn: 40 },
    },
    map,
  );
}
