export interface HistoryReplayTransactionEffects {
    setHistorySuppressed(suppressed: boolean): void;
    setBusy(busy: boolean): void;
}

export async function runHistoryReplayTransaction<T>(
    effects: HistoryReplayTransactionEffects,
    operation: () => Promise<T>
): Promise<T> {
    effects.setHistorySuppressed(true);
    effects.setBusy(true);

    try {
        return await operation();
    } finally {
        effects.setHistorySuppressed(false);
        effects.setBusy(false);
    }
}
