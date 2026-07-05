import type { Page } from '@playwright/test';

const DB_NAME = 'SaferStreetMakerDB';
const STORAGE_RESET_STATE_KEY = '__saferStreetMakerStorageResetState';

type StoredMapRecord = {
    title: string;
    sortOrder: number;
    updatedAt: string;
    payloadVersion: number;
    payload: {
        s: {
            t: string;
            r: 0 | 1;
            h: 0 | 1;
            a: string[];
            c: [number, number] | null;
            z: number;
            v: string;
        };
        l: Record<string, unknown>;
        d: string;
    };
};

async function withDatabase<T>(
    page: Page,
    action: (databaseName: string) => Promise<T>
): Promise<T> {
    return await action(DB_NAME);
}

export async function addFreshStorageInitScript(page: Page): Promise<void> {
    await page.addInitScript((databaseName: string) => {
        (window as any).__saferStreetMakerStorageResetState = 'pending';
        localStorage.clear();
        sessionStorage.clear();
        const deleteRequest = indexedDB.deleteDatabase(databaseName);
        deleteRequest.onsuccess = () => {
            (window as any).__saferStreetMakerStorageResetState = 'done';
        };
        deleteRequest.onerror = () => {
            (window as any).__saferStreetMakerStorageResetState =
                `error:${String(deleteRequest.error)}`;
        };
        deleteRequest.onblocked = () => {
            (window as any).__saferStreetMakerStorageResetState = 'blocked';
        };
    }, DB_NAME);
}

export async function waitForFreshStorage(page: Page): Promise<void> {
    await page.waitForFunction((stateKey: string) => {
        return (window as any)[stateKey] !== 'pending';
    }, STORAGE_RESET_STATE_KEY);

    const storageResetState = await page.evaluate((stateKey: string) => {
        return (window as any)[stateKey] as string | undefined;
    }, STORAGE_RESET_STATE_KEY);

    if (storageResetState !== 'done') {
        throw new Error(`Fresh storage reset failed before test start: ${storageResetState}`);
    }
}

export async function clearIndexedDb(page: Page): Promise<void> {
    await withDatabase(page, async (databaseName) => {
        await page.evaluate(async (name) => {
            await new Promise<void>((resolve, reject) => {
                const deleteRequest = indexedDB.deleteDatabase(name);
                deleteRequest.onsuccess = () => resolve();
                deleteRequest.onerror = () => reject(deleteRequest.error);
                deleteRequest.onblocked = () => resolve();
            });
        }, databaseName);
    });
}

export async function seedStoredMap(page: Page, mapName: string): Promise<void> {
    const record: StoredMapRecord = {
        title: mapName,
        sortOrder: Date.now(),
        updatedAt: new Date().toISOString(),
        payloadVersion: 1,
        payload: {
            s: {
                t: mapName,
                r: 0,
                h: 0,
                a: [],
                c: [52.5, -1.9],
                z: 12,
                v: '0.8.1'
            },
            l: {},
            d: new Date().toISOString()
        }
    };

    await withDatabase(page, async (databaseName) => {
        await page.evaluate(
            async ({ name, storedMap }) => {
                await new Promise<void>((resolve, reject) => {
                    const openRequest = indexedDB.open(name);
                    openRequest.onupgradeneeded = () => {
                        const db = openRequest.result;
                        if (!db.objectStoreNames.contains('maps')) {
                            const mapsStore = db.createObjectStore('maps', { keyPath: 'title' });
                            mapsStore.createIndex('sortOrder', 'sortOrder', { unique: false });
                            mapsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                        }
                        if (!db.objectStoreNames.contains('metadata')) {
                            db.createObjectStore('metadata', { keyPath: 'key' });
                        }
                    };
                    openRequest.onerror = () => reject(openRequest.error);
                    openRequest.onsuccess = () => {
                        const db = openRequest.result;
                        const tx = db.transaction(['maps', 'metadata'], 'readwrite');
                        tx.objectStore('maps').clear();
                        tx.objectStore('metadata').clear();
                        tx.objectStore('maps').put(storedMap);
                        tx.objectStore('metadata').put({
                            key: 'lastSelectedMap',
                            value: storedMap.title
                        });
                        tx.oncomplete = () => {
                            db.close();
                            resolve();
                        };
                        tx.onerror = () => reject(tx.error);
                    };
                });
            },
            { name: databaseName, storedMap: record }
        );
    });
}

export async function getLayerFeatureCount(
    page: Page,
    mapName: string,
    layerId: string
): Promise<number> {
    return await withDatabase(page, async (databaseName) => {
        return await page.evaluate(
            async ({ name, title, id }) => {
                return await new Promise<number>((resolve, reject) => {
                    const openRequest = indexedDB.open(name);
                    openRequest.onupgradeneeded = () => {
                        const db = openRequest.result;
                        if (!db.objectStoreNames.contains('maps')) {
                            const mapsStore = db.createObjectStore('maps', { keyPath: 'title' });
                            mapsStore.createIndex('sortOrder', 'sortOrder', { unique: false });
                            mapsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                        }
                        if (!db.objectStoreNames.contains('metadata')) {
                            db.createObjectStore('metadata', { keyPath: 'key' });
                        }
                    };
                    openRequest.onerror = () => reject(openRequest.error);
                    openRequest.onsuccess = () => {
                        const db = openRequest.result;
                        const tx = db.transaction('maps', 'readonly');
                        const getRequest = tx.objectStore('maps').get(title);
                        getRequest.onsuccess = () => {
                            const record = getRequest.result as StoredMapRecord | undefined;
                            const featureCollection = record?.payload?.l?.[id] as
                                { features?: unknown[] } | undefined;
                            resolve(featureCollection?.features?.length ?? 0);
                        };
                        getRequest.onerror = () => reject(getRequest.error);
                        tx.oncomplete = () => db.close();
                    };
                });
            },
            { name: databaseName, title: mapName, id: layerId }
        );
    });
}
