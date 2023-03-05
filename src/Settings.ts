import { LatLng } from "leaflet";

export class Settings {
    title: string = 'Hello, Cleveland';
    readOnly: boolean = false;
    hideToolbar: boolean = false;
    activeLayers: string[] = new Array<string>();
    centre: LatLng;
    zoom: number;
    version: string;
}