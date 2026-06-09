import { LatLng } from "leaflet";

export class Settings {
    title: string = 'Hello, Cleveland';
    readOnly: boolean = false;
    hideToolbar: boolean = false;
    activeLayers: string[] = new Array<string>();
    centre: LatLng = new LatLng(0, 0);
    zoom: number = 0;
    version: string = '';
}