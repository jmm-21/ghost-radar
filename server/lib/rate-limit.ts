import { anonymousClientId, HttpError } from './http.js';
import type { Store } from './store.js';

export interface RateLimitRule {
  /** Nombre del límite, p. ej. "events". */
  scope: string;
  /** Peticiones permitidas por ventana. */
  limit: number;
  /** Duración de la ventana en segundos. */
  windowSeconds: number;
}

/** Ventana fija: cuenta peticiones por cliente anónimo y ventana de tiempo. */
export async function enforceRateLimit(store: Store, req: Request, rule: RateLimitRule, now = Date.now()): Promise<void> {
  const window = Math.floor(now / 1000 / rule.windowSeconds);
  const key = `rl:${rule.scope}:${anonymousClientId(req, new Date(now))}:${window}`;
  const count = await store.incr(key, rule.windowSeconds);
  if (count > rule.limit) throw new HttpError(429, 'Demasiadas peticiones. Espera un momento.');
}
