/**
 * Shared group factory for the groupStore unit tests.
 */
import type { Group } from '../../../src/models/Group';

export function makeGroup(id: string, name: string, memberHistoryIds: string[] = []): Group {
    return {
        id,
        name,
        members: memberHistoryIds.map((historyId) => ({ layerId: 'ModalFilters', historyId }))
    };
}
