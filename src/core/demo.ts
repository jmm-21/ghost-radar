import type { Network } from '../../shared/types';
import type { Account, RawLists } from './types';

/** Genera datos de ejemplo deterministas para probar la app sin exportar nada. */
export function demoLists(network: Network, now = Date.now()): RawLists {
  const names = ['luna', 'sol', 'mar', 'dani', 'alex', 'sara', 'pablo', 'ines', 'hugo', 'nora', 'leo', 'vera', 'marta', 'raul', 'eva', 'iker', 'lola', 'teo', 'ana', 'bruno', 'clara', 'dario', 'elena', 'fran', 'gala', 'hector', 'irene', 'jorge'];
  const suffixes = ['_bcn', '.foto', '_mad', '.viajes', '_99', '.art', '_oficial', '.music', '_gym', '.cocina'];
  const day = 864e5;
  const out: RawLists = { followers: [], following: [] };

  for (let i = 0; i < 140; i++) {
    const handle = names[i % names.length]! + suffixes[(i * 7) % suffixes.length]! + (i > 60 ? i : '');
    const ts = now - ((i * 37) % 900) * day;
    const account: Account =
      network === 'x'
        ? { key: `id:${1000 + i}`, id: String(1000 + i), handle: '', ts: 0, source: 'x' }
        : { key: handle, handle, ts, source: network === 'tiktok' ? 'tiktok' : 'meta' };
    if (i % 5 !== 0) out.following.push(account);
    if (i % 3 !== 0) out.followers.push(account);
  }
  return out;
}
