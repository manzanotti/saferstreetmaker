export interface GroupMember {
    layerId: string;
    historyId: string;
}

export interface Group {
    id: string;
    name: string;
    members: GroupMember[];
}
