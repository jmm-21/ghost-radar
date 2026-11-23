import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getStats, health, listFeedback, recordEvent, submitFeedback, type Deps } from '../server/handlers/index';
import { MemoryStore, RedisRestStore, createStore } from '../server/lib/store';

const post = (url: string, body: unknown, ip = '1.2.3.4') =>
  new Request(`http://test${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const get = (url: string, headers: Record<string, string> = {}) => new Request(`http://test${url}`, { headers });

let deps: Deps;
beforeEach(() => {
  deps = { store: new MemoryStore(), env: { ADMIN_TOKEN: 'secreto' }, now: () => Date.UTC(2026, 10, 17) };
});

describe('GET /api/health', () => {
  it('responde ok e indica el almacenamiento', async () => {
    const res = await health(get('/api/health'), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok', storage: 'memory' });
  });
});

describe('POST /api/events + GET /api/stats', () => {
  it('cuenta los análisis por red', async () => {
    await recordEvent(post('/api/events', { type: 'analysis_completed', network: 'instagram' }), deps);
    await recordEvent(post('/api/events', { type: 'analysis_completed', network: 'tiktok' }), deps);
    const res = await recordEvent(post('/api/events', { type: 'demo_used', network: 'x' }), deps);
    expect(res.status).toBe(204);

    const stats = await (await getStats(get('/api/stats'), deps)).json();
    expect(stats).toEqual({ totalAnalyses: 2, byNetwork: { instagram: 1, tiktok: 1, x: 0, threads: 0 } });
  });

  it('cachea las estadísticas en el CDN', async () => {
    const res = await getStats(get('/api/stats'), deps);
    expect(res.headers.get('cache-control')).toContain('s-maxage=60');
  });

  it('rechaza eventos no válidos', async () => {
    expect((await recordEvent(post('/api/events', { type: 'hack', network: 'instagram' }), deps)).status).toBe(400);
    expect((await recordEvent(post('/api/events', { type: 'demo_used', network: 'myspace' }), deps)).status).toBe(400);
    expect((await recordEvent(post('/api/events', '{no es json'), deps)).status).toBe(400);
    expect((await recordEvent(post('/api/events', 'x'.repeat(2000)), deps)).status).toBe(413);
  });

  it('limita a 30 eventos por minuto por cliente', async () => {
    const send = (ip: string) => recordEvent(post('/api/events', { type: 'demo_used', network: 'x' }, ip), deps);
    for (let i = 0; i < 30; i++) expect((await send('9.9.9.9')).status).toBe(204);
    expect((await send('9.9.9.9')).status).toBe(429);
    expect((await send('8.8.8.8')).status).toBe(204); // otro cliente no se ve afectado
  });
});

describe('POST/GET /api/feedback', () => {
  it('guarda una opinión válida', async () => {
    const res = await submitFeedback(post('/api/feedback', { message: '  Me encanta  ', rating: 5, contact: '@yo' }), deps);
    expect(res.status).toBe(201);
    const list = await (await listFeedback(get('/api/feedback', { authorization: 'Bearer secreto' }), deps)).json();
    expect(list.count).toBe(1);
    expect(list.items[0]).toMatchObject({ message: 'Me encanta', rating: 5, contact: '@yo' });
  });

  it('valida mensaje y valoración', async () => {
    expect((await submitFeedback(post('/api/feedback', { message: 'a' }), deps)).status).toBe(400);
    expect((await submitFeedback(post('/api/feedback', { message: 'hola', rating: 9 }), deps)).status).toBe(400);
    expect((await submitFeedback(post('/api/feedback', { message: 'x'.repeat(1001) }), deps)).status).toBe(400);
  });

  it('limita a 5 opiniones por hora', async () => {
    for (let i = 0; i < 5; i++) expect((await submitFeedback(post('/api/feedback', { message: 'hola' }), deps)).status).toBe(201);
    expect((await submitFeedback(post('/api/feedback', { message: 'hola' }), deps)).status).toBe(429);
  });

  it('solo el administrador puede leer las opiniones', async () => {
    expect((await listFeedback(get('/api/feedback'), deps)).status).toBe(401);
    expect((await listFeedback(get('/api/feedback', { authorization: 'Bearer mal' }), deps)).status).toBe(401);
    expect((await listFeedback(get('/api/feedback'), { ...deps, env: {} })).status).toBe(401);
  });
});

describe('almacenamiento', () => {
  it('MemoryStore respeta la caducidad', async () => {
    let now = 0;
    const store = new MemoryStore(() => now);
    expect(await store.incr('k', 10)).toBe(1);
    expect(await store.incr('k', 10)).toBe(2);
    now = 11_000;
    expect(await store.getMany(['k'])).toEqual([0]);
    expect(await store.incr('k', 10)).toBe(1);
  });

  it('RedisRestStore envía comandos en pipeline a Upstash', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ result: 3 }, { result: 1 }])));
    const store = new RedisRestStore('https://redis.example/', 'tok', fetchMock as unknown as typeof fetch);
    expect(await store.incr('k', 60)).toBe(3);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://redis.example/pipeline');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok' });
    expect(JSON.parse(init.body as string)).toEqual([['INCR', 'k'], ['EXPIRE', 'k', 60, 'NX']]);
  });

  it('createStore elige Redis si hay credenciales y memoria si no', () => {
    expect(createStore({ KV_REST_API_URL: 'u', KV_REST_API_TOKEN: 't' }).kind).toBe('redis');
    expect(createStore({ UPSTASH_REDIS_REST_URL: 'u', UPSTASH_REDIS_REST_TOKEN: 't' }).kind).toBe('redis');
    expect(createStore({}).kind).toBe('memory');
  });
});

describe('compartir (respaldo sin service worker)', () => {
  it('abre la herramienta', async () => {
    const { POST } = await import('../api/compartir');
    const res = POST();
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('/?compartido=1#analizar');
  });
});
