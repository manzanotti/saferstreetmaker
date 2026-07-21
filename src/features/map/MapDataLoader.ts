import * as L from 'leaflet';
import type { SerializedMap } from '../../services/MapSerializer';
import { Settings } from '../../models/Settings';
import type { Group } from '../../models/Group';
import { MapLayerController } from './MapLayerController';

export interface MapDataLoaderOptions {
    getMap: () => L.Map;
    setDefaultView: () => void;
    mapLayerController: MapLayerController;
    setTitle: (title: string) => void;
    applySettings: (settings: {
        title: string;
        readOnly: boolean;
        hideToolbar: boolean;
        activeLayers: string[];
        centre: L.LatLng | null;
        zoom: number;
        version: string;
    }) => void;
    setCentre: (centre: L.LatLng) => void;
    setZoom: (zoom: number) => void;
    getCentre: () => L.LatLng | null;
    getZoom: () => number;
    setVersion: (version: string) => void;
    getActiveLayerIds: () => string[];
    setVisibleLayerIds: (layerIds: Set<string>) => void;
    setGroups: (groups: Group[]) => void;
    setAllGroupsHidden: (hidden: boolean) => void;
    resetGroupVisibility: () => void;
    recomputeGroupVisibility?: () => void;
    pruneDanglingGroupMembers: () => void;
    appVersion: string;
}

export class MapDataLoader {
    private readonly getMap: () => L.Map;
    private readonly setDefaultView: () => void;
    private readonly mapLayerController: MapLayerController;
    private readonly setTitle: (title: string) => void;
    private readonly applySettings: MapDataLoaderOptions['applySettings'];
    private readonly setCentre: (centre: L.LatLng) => void;
    private readonly setZoom: (zoom: number) => void;
    private readonly getCentre: () => L.LatLng | null;
    private readonly getZoom: () => number;
    private readonly setVersion: (version: string) => void;
    private readonly getActiveLayerIds: () => string[];
    private readonly setVisibleLayerIds: (layerIds: Set<string>) => void;
    private readonly setGroups: (groups: Group[]) => void;
    private readonly setAllGroupsHidden: (hidden: boolean) => void;
    private readonly resetGroupVisibility: () => void;
    private readonly recomputeGroupVisibility: () => void;
    private readonly pruneDanglingGroupMembers: () => void;
    private readonly appVersion: string;

    constructor(options: MapDataLoaderOptions) {
        this.getMap = options.getMap;
        this.setDefaultView = options.setDefaultView;
        this.mapLayerController = options.mapLayerController;
        this.setTitle = options.setTitle;
        this.applySettings = options.applySettings;
        this.setCentre = options.setCentre;
        this.setZoom = options.setZoom;
        this.getCentre = options.getCentre;
        this.getZoom = options.getZoom;
        this.setVersion = options.setVersion;
        this.getActiveLayerIds = options.getActiveLayerIds;
        this.setVisibleLayerIds = options.setVisibleLayerIds;
        this.setGroups = options.setGroups;
        this.setAllGroupsHidden = options.setAllGroupsHidden;
        this.resetGroupVisibility = options.resetGroupVisibility;
        this.recomputeGroupVisibility = options.recomputeGroupVisibility ?? (() => {});
        this.pruneDanglingGroupMembers = options.pruneDanglingGroupMembers;
        this.appVersion = options.appVersion;
    }

    load(geoJSON: SerializedMap | null, zoom: string | null, centre: number[] | null): boolean {
        if (geoJSON === null) {
            return false;
        }

        const map = this.getMap();
        if (geoJSON.title !== undefined) {
            this.setTitle(geoJSON.title);
        }

        if (geoJSON.settings !== undefined) {
            const rawCentre = geoJSON.settings.centre;
            const settingsCentre = rawCentre ? new L.LatLng(rawCentre.lat, rawCentre.lng) : null;
            const settings: Settings = Object.assign(new Settings(), geoJSON.settings);
            this.applySettings({
                title: settings.title,
                readOnly: settings.readOnly,
                hideToolbar: settings.hideToolbar,
                activeLayers: settings.activeLayers,
                centre: settingsCentre,
                zoom: settings.zoom,
                version: settings.version
            });
        }

        if (geoJSON.layers !== undefined) {
            this.mapLayerController.loadLayers(geoJSON.layers, this.getActiveLayerIds());
        }

        if (
            geoJSON.settings === undefined &&
            geoJSON.centre !== undefined &&
            geoJSON.zoom !== undefined
        ) {
            this.setCentre(new L.LatLng(geoJSON.centre.lat, geoJSON.centre.lng));
            this.setZoom(geoJSON.zoom);
        }

        this.setVersion(this.appVersion);
        const resolvedCentre = this.applyOverrides(zoom, centre);
        if (resolvedCentre) {
            map.setView([resolvedCentre.lat, resolvedCentre.lng], this.getResolvedZoom(zoom));
        } else {
            this.setDefaultView();
        }

        const activeLayers = this.getActiveLayerIds();
        this.setVisibleLayerIds(new Set(activeLayers));
        this.setGroups(geoJSON.groups ?? []);
        this.setAllGroupsHidden(false);
        this.resetGroupVisibility();
        this.pruneDanglingGroupMembers();
        this.recomputeGroupVisibility();
        return true;
    }

    private applyOverrides(zoom: string | null, centre: number[] | null): L.LatLng | null {
        if (zoom && !Number.isNaN(Number(zoom))) {
            this.setZoom(Number(zoom));
        }
        if (centre && centre.length === 2) {
            const resolvedCentre = new L.LatLng(centre[0], centre[1]);
            this.setCentre(resolvedCentre);
            return resolvedCentre;
        }
        return this.getCentre();
    }

    private getResolvedZoom(zoom: string | null): number {
        if (zoom && !Number.isNaN(Number(zoom))) {
            return Number(zoom);
        }
        return this.getZoom();
    }
}
