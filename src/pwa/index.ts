import { registerSW } from 'virtual:pwa-register';
import { byId } from '../ui/dom';
import { platformOf } from './detect';
import { SHARE_CACHE, SHARE_PREFIX } from './share';

/** Evento que Chrome, Edge y Android lanzan cuando la web se puede instalar. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;


/**
 * Sección "Llévatela en el móvil": los pasos de las tres plataformas se ven siempre,
 * y se destaca la del dispositivo actual. Si ya está instalada, no se enseña.
 */
function initInstall(): void {
  if (isStandalone()) {
    byId('instalar').classList.add('hidden');
    document.querySelector('.install')?.classList.add('hidden');
    return;
  }
  const platform = platformOf(navigator.userAgent, navigator.maxTouchPoints);
  document.querySelector(`.get-app__card[data-platform="${platform}"]`)?.classList.add('is-you');

  // Chrome, Edge y Android ofrecen instalar con un botón: lo enseñamos solo cuando se puede.
  const button = byId<HTMLButtonElement>('install');
  let deferred: InstallPromptEvent | null = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    button.classList.remove('hidden');
  });
  button.addEventListener('click', async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    button.classList.add('hidden');
  });
  window.addEventListener('appinstalled', () => button.classList.add('hidden'));
}

/** Aviso discreto cuando no hay conexión: la app sigue funcionando. */
function initOffline(): void {
  const note = byId('offline');
  const paint = () => note.classList.toggle('hidden', navigator.onLine);
  window.addEventListener('online', paint);
  window.addEventListener('offline', paint);
  paint();
}

/** Registra el service worker y avisa cuando hay una versión nueva. */
function initServiceWorker(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  const banner = byId('update');
  const updateSW = registerSW({
    onNeedRefresh: () => banner.classList.remove('hidden'),
  });
  byId('updateBtn').addEventListener('click', () => void updateSW(true));
  byId('updateLater').addEventListener('click', () => banner.classList.add('hidden'));
}

/**
 * Archivos compartidos desde Android ("Compartir → ghost.radar"). El service worker
 * los ha dejado en una caché; aquí los recogemos, los borramos y los devolvemos.
 */
export async function takeSharedFiles(): Promise<File[] | null> {
  const params = new URLSearchParams(location.search);
  if (!params.has('compartido')) return null;
  history.replaceState(null, '', `${location.pathname}#analizar`);
  if (!('caches' in window)) return [];
  const cache = await caches.open(SHARE_CACHE);
  const files: File[] = [];
  for (const request of await cache.keys()) {
    if (!new URL(request.url).pathname.startsWith(SHARE_PREFIX)) continue;
    const response = await cache.match(request);
    if (response) {
      const name = decodeURIComponent(response.headers.get('x-file-name') ?? 'archivo.zip');
      files.push(new File([await response.blob()], name, { type: response.headers.get('content-type') ?? '' }));
    }
    await cache.delete(request);
  }
  return files;
}

export function initPwa(): void {
  initInstall();
  initOffline();
  initServiceWorker();
}
