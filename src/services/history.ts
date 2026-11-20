import type { Network } from '../../shared/types';
import { addSnapshot, diff, previousOf, type HistoryDiff, type Snapshot } from '../core/history';

/**
 * Guarda el historial en IndexedDB, dentro del navegador. Nada de esto se envía a ningún servidor.
 * Si el navegador no deja usar IndexedDB (modo privado en algunos navegadores), la app sigue
 * funcionando igual, solo que sin historial.
 */
const DB_NAME = 'ghost-radar';
const STORE = 'snapshots';
const KEY = 'all';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function readAll(): Promise<Snapshot[]> {
  return ((await run('readonly', (s) => s.get(KEY))) as Snapshot[] | undefined) ?? [];
}

/** Guarda la foto actual y devuelve la comparación con la anterior, si la hay. */
export async function recordAndCompare(current: Snapshot): Promise<HistoryDiff | null> {
  try {
    const all = await readAll();
    const previous = previousOf(all, current);
    await run('readwrite', (s) => s.put(addSnapshot(all, current), KEY));
    return previous ? diff(previous, current) : null;
  } catch {
    return null;
  }
}

/** Borra el historial de una red. */
export async function clearHistory(network: Network): Promise<void> {
  try {
    const rest = (await readAll()).filter((s) => s.network !== network);
    await run('readwrite', (s) => s.put(rest, KEY));
  } catch {
    /* sin historial que borrar */
  }
}
