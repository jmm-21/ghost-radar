import { STRINGS, type StringKey } from './strings';

export type Lang = keyof typeof STRINGS;
export const LANGS: Lang[] = ['es', 'en'];
const STORAGE_KEY = 'ghost-radar:lang';

/** Idioma inicial: el que eligió la persona, o el del navegador (español si empieza por "es"). */
export function detectLang(saved: string | null, browser: readonly string[]): Lang {
  if (saved === 'es' || saved === 'en') return saved;
  const first = browser[0]?.toLowerCase() ?? 'es';
  return first.startsWith('es') ? 'es' : 'en';
}

function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

let current: Lang =
  typeof navigator === 'undefined' ? 'es' : detectLang(readSaved(), navigator.languages ?? [navigator.language]);
const listeners = new Set<(lang: Lang) => void>();

export const lang = (): Lang => current;

/** Traduce una clave y sustituye los `{huecos}`. */
export function t(key: StringKey, vars: Record<string, string | number> = {}, to: Lang = current): string {
  return STRINGS[to][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

export const locale = (): string => (current === 'es' ? 'es-ES' : 'en-GB');

export function onLangChange(fn: (lang: Lang) => void): void {
  listeners.add(fn);
}

const ATTRS = ['aria-label', 'placeholder', 'alt'] as const;

/** Vídeos que existen en public/videos/, cada uno en los dos idiomas. */
export const VIDEOS = ['tutorial', 'exportar-instagram'] as const;

/**
 * Traduce el HTML estático. Cada elemento marcado con `data-i18n="clave"` recibe su texto,
 * y `data-i18n-aria-label`, `data-i18n-placeholder` o `data-i18n-alt` traducen ese atributo.
 * Los textos son nuestros (strings.ts), así que pueden llevar <b> o <code>.
 */
export function applyDom(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18n as StringKey);
  });
  for (const attr of ATTRS) {
    root.querySelectorAll<HTMLElement>(`[data-i18n-${attr}]`).forEach((el) => {
      el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`) as StringKey));
    });
  }
  // Capturas de la app: cada idioma tiene las suyas (public/screens/ y public/screens/en/).
  root.querySelectorAll<HTMLElement>('.screen img, .screen source').forEach((el) => {
    for (const attr of ['src', 'srcset']) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      const base = value.replace('/screens/en/', '/screens/');
      el.setAttribute(attr, current === 'en' ? base.replace('/screens/', '/screens/en/') : base);
    }
  });
  // Vídeos: uno por idioma (public/videos/<nombre>-es.mp4 y -en.mp4).
  // La ruta sale de una lista fija, nunca del texto de la página.
  root.querySelectorAll<HTMLVideoElement>('video[data-video]').forEach((v) => {
    const name = VIDEOS.find((n) => n === v.dataset.video);
    if (!name) return;
    const src = `/videos/${name}-${current}.mp4`;
    if (v.getAttribute('src') === src) return;
    v.pause();
    v.setAttribute('src', src);
    v.setAttribute('poster', `/videos/${name}-${current}.jpg`);
  });
  document.documentElement.lang = current;
  document.title = t('meta.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'));
  document.querySelectorAll<HTMLSelectElement>('select[data-lang]').forEach((s) => (s.value = current));
}

export function setLang(next: Lang): void {
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* modo privado: el idioma no se recuerda, pero se cambia igual */
  }
  applyDom();
  listeners.forEach((fn) => fn(next));
}

/** Conecta los desplegables de idioma de las cabeceras. */
export function initLangSelect(): void {
  document.querySelectorAll<HTMLSelectElement>('select[data-lang]').forEach((s) =>
    s.addEventListener('change', () => setLang(s.value as Lang)),
  );
  // El HTML ya viene en español: solo hay que reescribirlo si el idioma es otro.
  if (current === 'es') document.querySelectorAll<HTMLSelectElement>('select[data-lang]').forEach((s) => (s.value = 'es'));
  else applyDom();
}
