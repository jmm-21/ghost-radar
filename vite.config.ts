import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin, type ViteDevServer } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * En desarrollo, sirve las funciones de `api/` desde el propio servidor de Vite,
 * así `npm run dev` levanta frontend y backend a la vez, igual que en Vercel.
 */
function devApi(): Plugin {
  async function toRequest(req: IncomingMessage): Promise<Request> {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    return new Request(`http://localhost${req.url}`, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    });
  }

  async function send(res: ServerResponse, response: Response): Promise<void> {
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(Buffer.from(await response.arrayBuffer()));
  }

  return {
    name: 'ghost-radar-dev-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api', async (req, res, next) => {
        const name = (req.url ?? '').split('?')[0]?.replace(/^\//, '');
        if (!name || !/^[a-z-]+$/.test(name)) return next();
        try {
          const mod = (await server.ssrLoadModule(`/api/${name}.ts`)) as Record<string, unknown>;
          const handler = mod[req.method ?? 'GET'];
          if (typeof handler !== 'function') {
            res.statusCode = 405;
            return res.end();
          }
          const response = await (handler as (r: Request) => Promise<Response>)(await toRequest(req));
          await send(res, response);
        } catch (err) {
          server.ssrFixStacktrace(err as Error);
          next(err);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Las funciones de api/ leen process.env: en desarrollo cargamos ahí .env.local.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [devApi()],
    build: { target: 'es2022', sourcemap: true },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      coverage: { include: ['src/core/**', 'server/**', 'shared/**'] },
    },
  };
});
