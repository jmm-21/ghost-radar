import { describe, expect, it } from 'vitest';
import { compare } from '../src/core/compare';
import { addSnapshot, diff, MAX_SNAPSHOTS, previousOf, snapshotOf, type Snapshot } from '../src/core/history';
import type { Account } from '../src/core/types';

const acc = (handle: string): Account => ({ key: handle, handle, ts: 0, source: 'meta' });
const snap = (takenAt: number, followers: string[], network: Snapshot['network'] = 'instagram'): Snapshot => ({
  network,
  takenAt,
  followers: followers.map(acc),
  following: 0,
});

describe('historial', () => {
  it('detecta quién se ha ido y quién ha llegado', () => {
    const d = diff(snap(1, ['ana', 'luis', 'pepe']), snap(2, ['ana', 'pepe', 'marta', 'lola']));
    expect(d.lost.map((a) => a.key)).toEqual(['luis']);
    expect(d.gained.map((a) => a.key)).toEqual(['marta', 'lola']);
  });

  it('compara con la foto anterior más reciente de la misma red', () => {
    const all = [snap(10, ['a']), snap(30, ['b']), snap(20, ['c']), snap(25, ['d'], 'tiktok')];
    expect(previousOf(all, snap(40, []))?.takenAt).toBe(30);
    expect(previousOf(all, snap(26, []))?.takenAt).toBe(20);
  });

  it('subir la misma exportación otra vez no se compara consigo misma', () => {
    const all = [snap(10, ['a']), snap(20, ['a', 'b'])];
    expect(previousOf(all, snap(20, ['a', 'b']))?.takenAt).toBe(10);
  });

  it('no hay anterior en el primer análisis', () => {
    expect(previousOf([], snap(1, ['a']))).toBeNull();
    expect(previousOf([snap(5, ['a'], 'x')], snap(9, ['a']))).toBeNull();
  });

  it('sustituye la foto del mismo momento y limita cuántas se guardan', () => {
    let all: Snapshot[] = [snap(1, ['x'], 'tiktok')];
    for (let t = 1; t <= MAX_SNAPSHOTS + 5; t++) all = addSnapshot(all, snap(t, ['a']));
    all = addSnapshot(all, snap(MAX_SNAPSHOTS + 5, ['a', 'b']));
    const insta = all.filter((s) => s.network === 'instagram');
    expect(insta).toHaveLength(MAX_SNAPSHOTS);
    expect(insta[0]!.followers).toHaveLength(2);
    expect(all.filter((s) => s.network === 'tiktok')).toHaveLength(1);
  });

  it('crea la foto a partir de una comparación', () => {
    const s = snapshotOf('instagram', compare({ followers: [acc('a'), acc('a'), acc('b')], following: [acc('a')] }), 7);
    expect(s.followers.map((a) => a.key)).toEqual(['a', 'b']);
    expect(s.following).toBe(1);
    expect(s.takenAt).toBe(7);
  });
});
