/**
 * Lógica de cada endpoint, independiente de la plataforma de despliegue.
 * Reciben un `Request` estándar y devuelven un `Response` estándar, por lo que
 * funcionan igual en Vercel, en el servidor de desarrollo de Vite y en los tests.
 */
import {
  EVENT_TYPES,
  FEEDBACK_LIMITS,
  NETWORKS,
  isNetwork,
  type AnalyticsEvent,
  type FeedbackEntry,
  type FeedbackInput,
  type PublicStats,
} from '../../shared/types.js';
import { HttpError, json, readJson, withErrors } from '../lib/http.js';
import { enforceRateLimit } from '../lib/rate-limit.js';
import type { Store } from '../lib/store.js';

export interface Deps {
  store: Store;
  env?: Record<string, string | undefined>;
  now?: () => number;
}

const KEYS = {
  total: 'stats:total',
  network: (n: string) => `stats:network:${n}`,
  event: (t: string) => `stats:event:${t}`,
  day: (d: string) => `stats:day:${d}`,
  feedback: 'feedback',
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// ------------------------------------------------------------------ GET /api/health
export function health(_req: Request, { store }: Deps): Promise<Response> {
  return withErrors(async () => json({ status: 'ok', storage: store.kind, version: '1.0.0' }));
}

// ------------------------------------------------------------------ POST /api/events
export function validateEvent(body: unknown): AnalyticsEvent {
  if (!isObject(body)) throw new HttpError(400, 'Se esperaba un objeto JSON.');
  const { type, network } = body;
  if (typeof type !== 'string' || !(EVENT_TYPES as readonly string[]).includes(type)) {
    throw new HttpError(400, `"type" debe ser uno de: ${EVENT_TYPES.join(', ')}.`);
  }
  if (!isNetwork(network)) throw new HttpError(400, `"network" debe ser uno de: ${NETWORKS.join(', ')}.`);
  return { type: type as AnalyticsEvent['type'], network };
}

export function recordEvent(req: Request, { store, now = Date.now }: Deps): Promise<Response> {
  return withErrors(async () => {
    await enforceRateLimit(store, req, { scope: 'events', limit: 30, windowSeconds: 60 }, now());
    const event = validateEvent(await readJson(req, 512));
    const day = new Date(now()).toISOString().slice(0, 10);

    await store.incr(KEYS.event(event.type));
    if (event.type === 'analysis_completed') {
      await store.incr(KEYS.total);
      await store.incr(KEYS.network(event.network));
      await store.incr(KEYS.day(day), 60 * 60 * 24 * 400);
    }
    return new Response(null, { status: 204 });
  });
}

// ------------------------------------------------------------------ GET /api/stats
export function getStats(_req: Request, { store }: Deps): Promise<Response> {
  return withErrors(async () => {
    const [total = 0, ...perNetwork] = await store.getMany([KEYS.total, ...NETWORKS.map(KEYS.network)]);
    const stats: PublicStats = {
      totalAnalyses: total,
      byNetwork: Object.fromEntries(NETWORKS.map((n, i) => [n, perNetwork[i] ?? 0])) as PublicStats['byNetwork'],
    };
    // Cacheado en el CDN 60 s: las estadísticas no necesitan ser instantáneas.
    return json(stats, 200, { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' });
  });
}

// ------------------------------------------------------------------ POST /api/feedback
export function validateFeedback(body: unknown): FeedbackInput {
  if (!isObject(body)) throw new HttpError(400, 'Se esperaba un objeto JSON.');
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (message.length < FEEDBACK_LIMITS.messageMin || message.length > FEEDBACK_LIMITS.messageMax) {
    throw new HttpError(400, `El mensaje debe tener entre ${FEEDBACK_LIMITS.messageMin} y ${FEEDBACK_LIMITS.messageMax} caracteres.`);
  }
  const out: FeedbackInput = { message };
  if (body.rating !== undefined && body.rating !== null) {
    const r = Number(body.rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) throw new HttpError(400, 'La valoración debe ser un número del 1 al 5.');
    out.rating = r;
  }
  if (typeof body.contact === 'string' && body.contact.trim()) {
    const contact = body.contact.trim();
    if (contact.length > FEEDBACK_LIMITS.contactMax) throw new HttpError(400, 'El contacto es demasiado largo.');
    out.contact = contact;
  }
  return out;
}

export function submitFeedback(req: Request, { store, now = Date.now }: Deps): Promise<Response> {
  return withErrors(async () => {
    await enforceRateLimit(store, req, { scope: 'feedback', limit: 5, windowSeconds: 3600 }, now());
    const input = validateFeedback(await readJson(req, 4096));
    const entry: FeedbackEntry = { ...input, id: crypto.randomUUID(), createdAt: new Date(now()).toISOString() };
    await store.pushJson(KEYS.feedback, entry, 500);
    return json({ ok: true, id: entry.id }, 201);
  });
}

// ------------------------------------------------------------------ GET /api/feedback (solo admin)
export function listFeedback(req: Request, { store, env = process.env }: Deps): Promise<Response> {
  return withErrors(async () => {
    const adminToken = env.ADMIN_TOKEN;
    const given = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!adminToken || given !== adminToken) throw new HttpError(401, 'No autorizado.');
    const items = await store.listJson<FeedbackEntry>(KEYS.feedback, 200);
    return json({ items, count: items.length }, 200, { 'Cache-Control': 'no-store' });
  });
}
