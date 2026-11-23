import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin, type ViteDevServer } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { SHARE_ACTION, SHARE_FIELD } from './src/pwa/share';

/**
 * PWA: la web se puede instalar como app, funciona sin conexión y, en Android,
 * aparece en el menú "Compartir" para analizar el .zip directamente.
 */
const pwa = () =>
  VitePWA({
    strategies: 'injectManifest',
    srcDir: 'sw',
    filename: 'sw.ts',
    registerType: 'prompt',
    injectRegister: false,
    injectManifest: {
      globPatterns: ['**/*.{js,css,html,woff2,svg,png,webmanifest}'],
      // Lo pesado y opcional (capturas, vídeos, imagen para redes) no se descarga por adelantado.
      globIgnores: ['screens/**', 'videos/**', 'og-image.png'],
    },
    manifest: {
      id: '/',
      name: 'ghost.radar · ¿Quién no me sigue?',
      short_name: 'ghost.radar',
      description: 'Descubre quién no te sigue de vuelta en Instagram, TikTok, X y Threads. Sin contraseñas y sin conexión.',
      lang: 'es',
      dir: 'ltr',
      start_url: '/#analizar',
      scope: '/',
      display: 'standalone',
      background_color: '#faf8f5',
      theme_color: '#faf8f5',
      categories: ['social', 'utilities'],
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      screenshots: [
        { src: '/screens/movil-resumen.png', sizes: '780x1044', type: 'image/png', form_factor: 'narrow', label: 'Resumen de un análisis' },
        { src: '/screens/resultados.png', sizes: '2560x1404', type: 'image/png', form_factor: 'wide', label: 'Resultados en el ordenador' },
      ],
      share_target: {
        action: SHARE_ACTION,
        method: 'POST',
        enctype: 'multipart/form-data',
        params: {
          files: [
            {
              name: SHARE_FIELD,
              accept: ['application/zip', 'application/x-zip-compressed', '.zip', 'application/json', '.json', 'text/plain', '.txt', 'text/javascript', '.js'],
            },
          ],
        },
      },
    },
  });

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
    plugins: [devApi(), pwa()],
    build: { target: 'es2022', sourcemap: true },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      coverage: {
        include: ['src/core/**', 'server/**', 'shared/**'],
        reporter: ['text', 'json-summary', 'html'],
        // Si la cobertura baja de aquí, el CI falla.
        thresholds: { statements: 85, branches: 78, functions: 85, lines: 88 },
      },
    },
  };
});
