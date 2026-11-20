import type { Network } from '../../shared/types';
import type { Account, Comparison } from './types';

/**
 * Foto de tus seguidores en un momento dado. Se guarda solo en este dispositivo
 * (IndexedDB) para poder decirte, la próxima vez, quién se ha ido y quién ha llegado.
 */
export interface Snapshot {
  network: Network;
  /** Momento al que corresponden los datos: fecha de la exportación o, si no se sabe, del análisis. */
  takenAt: number;
  followers: Account[];
  following: number;
}

export interface HistoryDiff {
  previous: Snapshot;
  /** Te seguían en el análisis anterior y ya no. */
  lost: Account[];
  /** Te siguen ahora y antes no. */
  gained: Account[];
}

/** Cuántas fotos guardamos por red. Con unas pocas basta para comparar y no ocupa casi nada. */
export const MAX_SNAPSHOTS = 10;

export function snapshotOf(network: Network, data: Comparison, takenAt: number): Snapshot {
  return { network, takenAt, followers: [...data.followers.values()], following: data.following.size };
}

/**
 * Elige con qué foto comparar: la más reciente que sea **anterior** a la actual.
 * Así, si vuelves a subir la misma exportación, no te dice que no ha cambiado nada
 * respecto a sí misma, sino que te sigue comparando con la de antes.
 */
export function previousOf(snapshots: Snapshot[], current: Snapshot): Snapshot | null {
  let best: Snapshot | null = null;
  for (const s of snapshots) {
    if (s.network !== current.network || s.takenAt >= current.takenAt) continue;
    if (!best || s.takenAt > best.takenAt) best = s;
  }
  return best;
}

/** Diferencia entre dos fotos. O(n) con un Set de claves. */
export function diff(previous: Snapshot, current: Snapshot): HistoryDiff {
  const before = new Set(previous.followers.map((a) => a.key));
  const now = new Set(current.followers.map((a) => a.key));
  return {
    previous,
    lost: previous.followers.filter((a) => !now.has(a.key)),
    gained: current.followers.filter((a) => !before.has(a.key)),
  };
}

/**
 * Añade una foto al historial: sustituye a la del mismo momento (misma exportación subida otra vez)
 * y conserva solo las `MAX_SNAPSHOTS` más recientes de esa red.
 */
export function addSnapshot(snapshots: Snapshot[], current: Snapshot): Snapshot[] {
  const others = snapshots.filter((s) => s.network !== current.network);
  const same = snapshots
    .filter((s) => s.network === current.network && s.takenAt !== current.takenAt)
    .concat(current)
    .sort((a, b) => b.takenAt - a.takenAt)
    .slice(0, MAX_SNAPSHOTS);
  return [...others, ...same];
}
