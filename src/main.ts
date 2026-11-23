import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import { inject } from '@vercel/analytics';
import { initLangSelect, locale, onLangChange, t } from './i18n';
import { initPwa, takeSharedFiles } from './pwa';
import { fetchStats } from './services/api';
import { Analyzer, initVideoDialog } from './ui/analyzer';
import { byId } from './ui/dom';
import { initFeedback } from './ui/feedback';
import { animateGhost } from './ui/ghost';

/** Navegación entre la portada y la herramienta, con #analizar en la URL para poder compartirla. */
function initRouter(): void {
  const show = (view: 'home' | 'app', push = false) => {
    const app = view === 'app';
    // Un enlace interno (#como-funciona) también dispara popstate: solo se cambia de pantalla si hace falta.
    if (!push && byId('appView').classList.contains('hidden') === !app) return;
    byId('home').classList.toggle('hidden', app);
    byId('appView').classList.toggle('hidden', !app);
    if (push) history.pushState(null, '', app ? '#analizar' : location.pathname);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  byId('start').addEventListener('click', () => show('app', true));
  document.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => show('app', true)));
  byId('back').addEventListener('click', () => show('home', true));
  byId('toHome').addEventListener('click', () => show('home', true));
  window.addEventListener('popstate', () => show(location.hash === '#analizar' ? 'app' : 'home'));
  if (location.hash === '#analizar') show('app');
}

async function showPublicCounter(): Promise<void> {
  const stats = await fetchStats();
  // Si la API no responde o responde algo inesperado, el contador simplemente no sale.
  if (!stats || typeof stats.totalAnalyses !== 'number' || stats.totalAnalyses <= 0) return;
  const total = stats.totalAnalyses;
  const paint = () => {
    const el = byId('counter');
    const b = document.createElement('b');
    b.textContent = total.toLocaleString(locale());
    el.replaceChildren(b, t('hero.counter'));
  };
  paint();
  onLangChange(paint);
}

/** Selector de capturas de la portada: flechas para moverse, como un tablist. Sin script se ven todas. */
function initSwitcher(): void {
  document.querySelectorAll<HTMLElement>('[data-switch]').forEach((root) => {
    const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const select = (tab: HTMLButtonElement, focus = false) => {
      for (const t of tabs) {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls') ?? '')?.toggleAttribute('hidden', !on);
      }
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', (e) => {
        const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        select(tabs[(i + step + tabs.length) % tabs.length]!, true);
      });
    });
    const first = tabs.find((t) => t.getAttribute('aria-selected') === 'true') ?? tabs[0];
    if (first) select(first);
  });
}

/** La única animación de entrada: los nodos del mapa aparecen uno tras otro, una vez. */
function initReveal(): void {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }),
    { rootMargin: '0px 0px -10% 0px' },
  );
  document.querySelectorAll('.diagram').forEach((el) => io.observe(el));
}

// Estadísticas de visitas de Vercel: sin cookies y sin datos personales.
inject({ mode: import.meta.env.PROD ? 'production' : 'development' });

document.documentElement.classList.add('js');
initLangSelect();
initRouter();
initSwitcher();
initReveal();
const analyzer = new Analyzer();
initFeedback();
initVideoDialog();
animateGhost();
void showPublicCounter();
initPwa();
void takeSharedFiles().then((files) => {
  if (files) void analyzer.analyzeShared(files);
});
