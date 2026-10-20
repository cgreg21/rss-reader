/** Minimal IndexedDB wrapper: everything is persisted locally so articles stay readable offline. */
export type StoreName = 'feeds' | 'categories' | 'articles';

const STORES: StoreName[] = ['feeds', 'categories', 'articles'];

let connection: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('rssreader', 1);
    request.onupgradeneeded = () => {
      for (const name of STORES) request.result.createObjectStore(name, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return connection;
}

async function run<T>(store: StoreName, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = op(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const db = {
  all: <T>(store: StoreName) => run<T[]>(store, 'readonly', (s) => s.getAll()),
  put: (store: StoreName, value: object) => run(store, 'readwrite', (s) => s.put(value)),
  remove: (store: StoreName, id: string) => run(store, 'readwrite', (s) => s.delete(id)),
  async putMany(store: StoreName, values: object[]): Promise<void> {
    const handle = await open();
    return new Promise((resolve, reject) => {
      const tx = handle.transaction(store, 'readwrite');
      for (const value of values) tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};
