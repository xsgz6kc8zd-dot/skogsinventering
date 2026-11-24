// Liten IndexedDB-wrapper. All data stannar på enheten tills den exporteras.
const DB_NAME = 'skogsinventering';
const VERSION = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('observations')) {
        const s = db.createObjectStore('observations', { keyPath: 'id' });
        s.createIndex('objectId', 'objectId');
      }
      if (!db.objectStoreNames.contains('photos')) {
        const s = db.createObjectStore('photos', { keyPath: 'id' });
        s.createIndex('obsId', 'obsId');
      }
      if (!db.objectStoreNames.contains('objects')) db.createObjectStore('objects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then(r => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

const reqP = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export const db = {
  put: (store, value) => tx(store, 'readwrite', s => reqP(s.put(value))),
  get: (store, key) => tx(store, 'readonly', s => reqP(s.get(key))),
  del: (store, key) => tx(store, 'readwrite', s => reqP(s.delete(key))),
  all: (store) => tx(store, 'readonly', s => reqP(s.getAll())),
  byIndex: (store, index, key) => tx(store, 'readonly', s => reqP(s.index(index).getAll(key))),
  clear: (store) => tx(store, 'readwrite', s => reqP(s.clear())),
  // Flera skrivningar i EN transaktion: antingen sparas allt eller inget (t.ex. fynd + foton).
  atomic: (ops) => open().then(d => new Promise((resolve, reject) => {
    const t = d.transaction([...new Set(ops.map(o => o.store))], 'readwrite');
    for (const o of ops) o.del ? t.objectStore(o.store).delete(o.key) : t.objectStore(o.store).put(o.value);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  })),
  getKV: (key) => tx('kv', 'readonly', s => reqP(s.get(key))),
  setKV: (key, value) => tx('kv', 'readwrite', s => reqP(s.put(value, key))),
};

export function uid(prefix = '') {
  const r = crypto.getRandomValues(new Uint8Array(6));
  return prefix + Date.now().toString(36) + Array.from(r, b => b.toString(16).padStart(2, '0')).join('');
}
