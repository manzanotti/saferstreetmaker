export class ToolbarButton {
    public id: string;
    public text: string;
    public tooltip: string;
    public selected: boolean;
    public groupName: string;
    public buttons: Array<ToolbarButton>;
    public action: (e: Event, map: L.Map) => void;
    public isFirst: boolean;
}