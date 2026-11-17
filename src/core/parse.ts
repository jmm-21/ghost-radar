/**
 * Lectores de las exportaciones oficiales de cada red social.
 *
 * Todas las funciones son puras (sin DOM ni red) para poder probarlas con Vitest
 * y reutilizarlas en cualquier entorno.
 *
 * Formatos soportados:
 *  - Instagram / Threads (Meta): JSON con `string_list_data`, o HTML.
 *  - TikTok: JSON (`UserName` + `Date`) o TXT ("Date: …\nUsername: …").
 *  - X / Twitter: `follower.js` / `following.js` (`window.YTD… = [...]`), solo ids.
 */
import type { Network } from '../../shared/types';
import type { Account, RawLists, TextFile } from './types';

type Kind = keyof RawLists;

/** Rutas y claves que contienen listas parecidas pero que NO son seguidores/seguidos. */
const EXCLUDE =
  /hashtag|pending|request|unfollow|close_friend|block|restrict|remov|suggest|hide|mute|favorit|story|stories/i;

export const basename = (path: string): string => path.split('/').pop() ?? path;

export function handleFromHref(href: unknown): string {
  if (typeof href !== 'string') return '';
  const m = href.match(/(?:instagram|threads|tiktok)\.(?:com|net)\/(?:_u\/)?@?([^/?#]+)/i);
  return m?.[1] ? decodeURIComponent(m[1]) : '';
}

/** Decide si una ruta de claves describe seguidores o seguidos (la clave más profunda manda). */
export function classify(segments: string[]): Kind | null {
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i]!.toLowerCase();
    if (s.includes('following')) return 'following';
    if (/follower|fans/.test(s)) return 'followers';
  }
  return null;
}

/** Convierte segundos, milisegundos o fechas de texto ("2024-01-02 10:00:00 UTC") a ms. */
export function toTimestamp(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
  let s = String(value).trim();
  const utc = /\s*UTC$/i.test(s);
  s = s.replace(/\s*UTC$/i, '').replace(' ', 'T') + (utc ? 'Z' : '');
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Normaliza una entrada de cualquier red a `Account`, o `null` si no lo es. */
export function extractAccount(input: unknown): Account | null {
  if (!isObject(input)) return null;
  let o: Json = input;
  if (isObject(o.following)) o = o.following;
  else if (isObject(o.follower)) o = o.follower;

  // X / Twitter
  if (o.accountId != null) {
    const id = String(o.accountId);
    return { key: `id:${id}`, id, handle: '', ts: 0, source: 'x' };
  }

  // Meta (Instagram / Threads)
  if (Array.isArray(o.string_list_data)) {
    const s: Json = isObject(o.string_list_data[0]) ? o.string_list_data[0] : {};
    const handle = String(s.value || o.title || handleFromHref(s.href) || '').trim();
    return handle
      ? { key: handle.toLowerCase(), handle, ts: toTimestamp(s.timestamp), source: 'meta' }
      : null;
  }

  // TikTok y formatos genéricos
  const handle = o.UserName ?? o.userName ?? o.username ?? o.Username ?? o.uniqueId ?? o.unique_id;
  if (typeof handle === 'string' && handle) {
    return {
      key: handle.toLowerCase(),
      handle,
      ts: toTimestamp(o.Date ?? o.date ?? o.time),
      source: 'tiktok',
    };
  }
  return null;
}

/** Recorre un JSON arbitrario buscando arrays de cuentas y los clasifica por su ruta. */
function walk(node: unknown, segments: string[], out: RawLists): void {
  if (EXCLUDE.test(segments.join('/'))) return;
  if (Array.isArray(node)) {
    const accounts = node.map(extractAccount).filter((a): a is Account => a !== null);
    if (accounts.length) {
      const kind = classify(segments);
      if (kind) out[kind].push(...accounts);
      return;
    }
    node.forEach((n) => walk(n, segments, out));
  } else if (isObject(node)) {
    for (const [k, v] of Object.entries(node)) walk(v, [...segments, k], out);
  }
}

function parseHtml(name: string, text: string, out: RawLists): void {
  const kind = classify([name]);
  if (!kind) return;
  const re = /href="(https?:\/\/[^"]*(?:instagram|threads)\.(?:com|net)\/[^"]+)"/gi;
  for (const m of text.matchAll(re)) {
    const handle = handleFromHref(m[1]);
    if (handle) out[kind].push({ key: handle.toLowerCase(), handle, ts: 0, source: 'meta' });
  }
}

function parseTikTokTxt(name: string, text: string, out: RawLists): void {
  const kind = classify([name]);
  if (!kind) return;
  for (const block of text.split(/\n\s*\n/)) {
    const user = block.match(/User\s*name:\s*(\S+)/i)?.[1];
    if (!user) continue;
    const date = block.match(/Date:\s*(.+)/i)?.[1]?.trim();
    out[kind].push({ key: user.toLowerCase(), handle: user, ts: toTimestamp(date), source: 'tiktok' });
  }
}

/** Lee un archivo y añade sus cuentas a `out`. Ignora en silencio lo que no reconoce. */
export function parseFile(file: TextFile, out: RawLists): void {
  const name = basename(file.path);
  if (EXCLUDE.test(name)) return;
  try {
    if (/\.js$/i.test(name)) {
      const i = file.text.indexOf('=');
      if (i >= 0) walk(JSON.parse(file.text.slice(i + 1)), [name], out);
    } else if (/\.json$/i.test(name)) {
      walk(JSON.parse(file.text), [name], out);
    } else if (/\.html?$/i.test(name)) {
      parseHtml(name, file.text, out);
    } else if (/\.txt$/i.test(name)) {
      parseTikTokTxt(name, file.text, out);
    }
  } catch {
    // Archivo corrupto o con otro formato: se ignora.
  }
}

/** ¿Merece la pena leer este archivo del .zip para la red elegida? */
export function isRelevantPath(path: string, network: Network): boolean {
  const p = path.toLowerCase();
  if (!/\.(json|js|html?|txt)$/.test(p)) return false;
  if (network === 'threads' && !p.includes('threads')) return false;
  if (network === 'instagram' && p.includes('threads')) return false;
  return classify([basename(p)]) !== null || /user_data|tiktok/.test(p);
}

export function parseFiles(files: TextFile[]): RawLists {
  const out: RawLists = { followers: [], following: [] };
  for (const f of files) parseFile(f, out);
  return out;
}

/** Red detectada a partir del contenido (X y TikTok se reconocen sin ambigüedad). */
export function detectNetwork(lists: RawLists): Network | null {
  const src = lists.following[0]?.source ?? lists.followers[0]?.source;
  if (src === 'x') return 'x';
  if (src === 'tiktok') return 'tiktok';
  return null;
}
