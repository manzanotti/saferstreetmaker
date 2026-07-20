import { describe, expect, it, vi } from 'vitest';
import {
    runHistoryReplayTransaction,
    type HistoryReplayTransactionEffects
} from '../../src/features/history/historyReplayTransaction';

function makeEffects(): HistoryReplayTransactionEffects & {
    suppressed: boolean[];
    busy: boolean[];
} {
    const suppressed: boolean[] = [];
    const busy: boolean[] = [];
    return {
        suppressed,
        busy,
        setHistorySuppressed: (value) => suppressed.push(value),
        setBusy: (value) => busy.push(value)
    };
}

describe('history replay transaction', () => {
    it('restores history state after a successful operation', async () => {
        const effects = makeEffects();

        await expect(runHistoryReplayTransaction(effects, async () => 'done')).resolves.toBe(
            'done'
        );

        expect(effects.suppressed).toEqual([true, false]);
        expect(effects.busy).toEqual([true, false]);
    });

    it('restores history state when the operation fails', async () => {
        const effects = makeEffects();
        const error = new Error('replay failed');

        await expect(
            runHistoryReplayTransaction(effects, async () => {
                throw error;
            })
        ).rejects.toBe(error);

        expect(effects.suppressed).toEqual([true, false]);
        expect(effects.busy).toEqual([true, false]);
    });

    it('does not swallow operation failures', async () => {
        const effects = makeEffects();
        const operation = vi.fn().mockRejectedValue(new Error('failure'));

        await expect(runHistoryReplayTransaction(effects, operation)).rejects.toThrow('failure');
        expect(operation).toHaveBeenCalledOnce();
    });
});
