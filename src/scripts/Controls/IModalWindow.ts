import { Settings } from "../../Settings";
import { IMapLayer } from "../layers/IMapLayer";
import { ToolbarButton } from "./ToolbarButton";

export interface IModalWindow {
    id: string;
    selected: boolean;

    getToolbarButton: () => ToolbarButton;
    getControl: () => L.Control;
    update: (settings: Settings, layers: Map<string, IMapLayer>) => void;
}