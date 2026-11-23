/// <reference lib="webworker" />
/**
 * Service worker de ghost.radar.
 *
 * - Guarda la web entera la primera vez que se visita, para que funcione sin conexión
 *   (el análisis ya se hace en el navegador, así que no hace falta nada más).
 * - Recibe los archivos que se comparten desde Android ("Compartir → ghost.radar"):
 *   los deja en una caché local y abre la herramienta, que los analiza al momento.
 * - La API (/api) nunca se guarda: siempre va a la red.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { SHARE_ACTION, SHARE_CACHE, SHARE_FIELD, SHARE_PREFIX } from '../src/pwa/share';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Cualquier página (también /#analizar al abrir la app) se sirve desde la copia guardada.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

// Las capturas grandes de la portada se guardan al verlas, sin descargarlas todas por adelantado.
registerRoute(
  ({ url }) => url.pathname.startsWith('/screens/'),
  new CacheFirst({ cacheName: 'capturas', plugins: [new ExpirationPlugin({ maxEntries: 20 })] }),
);

// "Compartir → ghost.radar" en Android llega como un POST con los archivos.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== SHARE_ACTION) return;
  event.respondWith(receiveShare(event.request));
});

async function receiveShare(request: Request): Promise<Response> {
  try {
    const form = await request.formData();
    const files = form.getAll(SHARE_FIELD).filter((f): f is File => f instanceof File);
    const cache = await caches.open(SHARE_CACHE);
    for (const key of await cache.keys()) await cache.delete(key);
    await Promise.all(
      files.map((file, i) =>
        cache.put(
          `${SHARE_PREFIX}${i}`,
          new Response(file, { headers: { 'x-file-name': encodeURIComponent(file.name), 'content-type': file.type } }),
        ),
      ),
    );
  } catch {
    /* si algo falla, la app se abre igualmente y pide el archivo */
  }
  return Response.redirect('/?compartido=1#analizar', 303);
}

// En la primera visita, toma el control enseguida: así funciona sin conexión desde ya.
// (Las versiones nuevas esperan a que la persona pulse "Actualizar".)
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// La app pide activar la versión nueva cuando la persona pulsa "Actualizar".
// Solo se aceptan mensajes de páginas de la propia web.
self.addEventListener('message', (event) => {
  if (event.origin !== self.location.origin) return;
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});
