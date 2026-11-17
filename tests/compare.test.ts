import { describe, expect, it } from 'vitest';
import { compare, filterAndSort, label } from '../src/core/compare';
import { demoLists } from '../src/core/demo';
import type { Account } from '../src/core/types';

const acc = (handle: string, ts = 0): Account => ({ key: handle.toLowerCase(), handle, ts, source: 'meta' });

describe('compare', () => {
  const result = compare({
    followers: [acc('ana'), acc('luis'), acc('Ana')],
    following: [acc('ana'), acc('marta')],
  });

  it('calcula quién no te sigue, a quién no sigues y los mutuos', () => {
    expect(result.notFollowingBack.map(label)).toEqual(['@marta']);
    expect(result.fans.map(label)).toEqual(['@luis']);
    expect(result.mutual.map(label)).toEqual(['@ana']);
  });

  it('elimina duplicados sin distinguir mayúsculas', () => {
    expect(result.followers.size).toBe(2);
  });

  it('calcula el porcentaje de seguimiento mutuo', () => {
    expect(result.followBackRate).toBe(50);
    expect(compare({ followers: [], following: [] }).followBackRate).toBe(0);
  });

  it('los datos de ejemplo son coherentes', () => {
    const demo = compare(demoLists('instagram', 0));
    expect(demo.mutual.length + demo.notFollowingBack.length).toBe(demo.following.size);
    expect(demo.mutual.length + demo.fans.length).toBe(demo.followers.size);
  });
});

describe('filterAndSort', () => {
  const list = [acc('zoe', 1), acc('ana', 3), acc('bea', 3)];

  it('ordena de más reciente a más antiguo y luego alfabéticamente', () => {
    expect(filterAndSort(list, '').map((a) => a.handle)).toEqual(['ana', 'bea', 'zoe']);
  });

  it('filtra ignorando la @ y las mayúsculas', () => {
    expect(filterAndSort(list, '@ZO').map((a) => a.handle)).toEqual(['zoe']);
  });

  it('etiqueta las cuentas de X sin nombre por su id', () => {
    expect(label({ key: 'id:5', id: '5', handle: '', ts: 0, source: 'x' })).toBe('Cuenta nº 5');
  });
});
