import { describe, expect, it } from 'vitest';
import { ghostPath } from '../src/ui/ghost';

describe('ghostPath', () => {
  it('mantiene los extremos fijos en cualquier fase (sin picos en los laterales)', () => {
    const first = (d: string) => d.match(/^M([\d.]+) ([\d.]+)/)!.slice(1).map(Number);
    for (const phase of [0, 1, 2, 3, 4, 5, 6]) expect(first(ghostPath(phase))).toEqual([13.6, 57]);
  });

  it('genera un path cerrado y válido', () => {
    expect(ghostPath(0)).toMatch(/^M[\d.]+ [\d.]+Q.*Z$/);
  });
});
