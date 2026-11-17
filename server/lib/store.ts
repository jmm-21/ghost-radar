/**
 * Capa de almacenamiento.
 *
 * - En producción usa Redis a través de la API REST de Upstash (gratuita en Vercel Marketplace).
 * - En desarrollo y en los tests usa memoria, así el proyecto arranca sin configurar nada.
 *
 * Los handlers solo conocen la interfaz `Store`, nunca la implementación concreta
 * (inversión de dependencias): cambiar de Redis a otra base de datos solo toca este archivo.
 */

export interface Store {
  readonly kind: 'redis' | 'memory';
  /** Incrementa un contador. Si se pasa `ttlSeconds`, caduca tras ese tiempo. */
  incr(key: string, ttlSeconds?: number): Promise<number>;
  /** Lee varios contadores (0 si no existen). */
  getMany(keys: string[]): Promise<number[]>;
  /** Añade un JSON al principio de una lista, conservando como máximo `max` elementos. */
  pushJson(key: string, value: unknown, max: number): Promise<void>;
  /** Devuelve los `limit` elementos más recientes de una lista. */
  listJson<T>(key: string, limit: number): Promise<T[]>;
}

// ---------------------------------------------------------------- Memoria
export class MemoryStore implements Store {
  readonly kind = 'memory' as const;
  private counters = new Map<string, { value: number; expiresAt?: number }>();
  private lists = new Map<string, string[]>();

  constructor(private now: () => number = Date.now) {}

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const current = this.counters.get(key);
    const alive = current && (!current.expiresAt || current.expiresAt > this.now());
    const value = (alive ? current.value : 0) + 1;
    const expiresAt = alive ? current.expiresAt : ttlSeconds ? this.now() + ttlSeconds * 1000 : undefined;
    this.counters.set(key, { value, expiresAt });
    return value;
  }

  async getMany(keys: string[]): Promise<number[]> {
    return keys.map((k) => {
      const c = this.counters.get(k);
      return c && (!c.expiresAt || c.expiresAt > this.now()) ? c.value : 0;
    });
  }

  async pushJson(key: string, value: unknown, max: number): Promise<void> {
    const list = this.lists.get(key) ?? [];
    list.unshift(JSON.stringify(value));
    this.lists.set(key, list.slice(0, max));
  }

  async listJson<T>(key: string, limit: number): Promise<T[]> {
    return (this.lists.get(key) ?? []).slice(0, limit).map((s) => JSON.parse(s) as T);
  }
}

// ---------------------------------------------------------------- Redis (Upstash REST)
type Command = (string | number)[];

export class RedisRestStore implements Store {
  readonly kind = 'redis' as const;

  constructor(
    private url: string,
    private token: string,
    private fetchFn: typeof fetch = fetch,
  ) {}

  private async pipeline(commands: Command[]): Promise<unknown[]> {
    const res = await this.fetchFn(`${this.url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
    });
    if (!res.ok) throw new Error(`Redis respondió ${res.status}`);
    const data = (await res.json()) as { result?: unknown; error?: string }[];
    const failed = data.find((d) => d.error);
    if (failed) throw new Error(`Redis: ${failed.error}`);
    return data.map((d) => d.result);
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const cmds: Command[] = [['INCR', key]];
    if (ttlSeconds) cmds.push(['EXPIRE', key, ttlSeconds, 'NX']);
    const [value] = await this.pipeline(cmds);
    return Number(value);
  }

  async getMany(keys: string[]): Promise<number[]> {
    if (!keys.length) return [];
    const [values] = await this.pipeline([['MGET', ...keys]]);
    return (values as (string | null)[]).map((v) => Number(v ?? 0));
  }

  async pushJson(key: string, value: unknown, max: number): Promise<void> {
    await this.pipeline([
      ['LPUSH', key, JSON.stringify(value)],
      ['LTRIM', key, 0, max - 1],
    ]);
  }

  async listJson<T>(key: string, limit: number): Promise<T[]> {
    const [values] = await this.pipeline([['LRANGE', key, 0, limit - 1]]);
    return (values as string[]).map((s) => JSON.parse(s) as T);
  }
}

// ---------------------------------------------------------------- Selección según entorno
let instance: Store | undefined;

export function createStore(env: NodeJS.ProcessEnv = process.env): Store {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new RedisRestStore(url, token);
  if (env.NODE_ENV === 'production') {
    console.warn('[ghost.radar] Sin Redis configurado: usando memoria (los datos no persistirán).');
  }
  return new MemoryStore();
}

export function getStore(): Store {
  instance ??= createStore();
  return instance;
}
