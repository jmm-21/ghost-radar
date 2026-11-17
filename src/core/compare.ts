import type { Account, Comparison, RawLists } from './types';

function dedupe(list: Account[]): Map<string, Account> {
  const map = new Map<string, Account>();
  for (const a of list) if (!map.has(a.key)) map.set(a.key, a);
  return map;
}

/** Compara seguidores y seguidos. Complejidad O(n) gracias a los Map. */
export function compare(lists: RawLists): Comparison {
  const followers = dedupe(lists.followers);
  const following = dedupe(lists.following);

  const notFollowingBack: Account[] = [];
  const mutual: Account[] = [];
  for (const a of following.values()) {
    const f = followers.get(a.key);
    if (f) mutual.push({ ...a, ts: Math.max(a.ts, f.ts) });
    else notFollowingBack.push(a);
  }
  const fans = [...followers.values()].filter((a) => !following.has(a.key));

  const followBackRate = following.size ? Math.round((mutual.length / following.size) * 100) : 0;
  return { followers, following, notFollowingBack, fans, mutual, followBackRate };
}

export function label(a: Account): string {
  return a.handle ? `@${a.handle}` : `Cuenta nº ${a.id ?? '?'}`;
}

/** Filtra por texto y ordena de más reciente a más antigua. */
export function filterAndSort(list: Account[], query: string): Account[] {
  const q = query.trim().toLowerCase().replace(/^@/, '');
  return list
    .filter((a) => !q || (a.handle || a.id || '').toLowerCase().includes(q))
    .sort((a, b) => b.ts - a.ts || label(a).localeCompare(label(b)));
}
