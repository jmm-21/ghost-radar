import { fetchStats } from './services/api';
import { Analyzer } from './ui/analyzer';
import { byId } from './ui/dom';
import { initFeedback } from './ui/feedback';
import { animateGhost } from './ui/ghost';

/** Navegación entre la portada y la herramienta, con #analizar en la URL para poder compartirla. */
function initRouter(): void {
  const show = (view: 'home' | 'app', push = false) => {
    const app = view === 'app';
    byId('home').classList.toggle('hidden', app);
    byId('appView').classList.toggle('hidden', !app);
    if (push) history.pushState(null, '', app ? '#analizar' : location.pathname);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  byId('start').addEventListener('click', () => show('app', true));
  byId('back').addEventListener('click', () => show('home', true));
  byId('toHome').addEventListener('click', () => show('home', true));
  window.addEventListener('popstate', () => show(location.hash === '#analizar' ? 'app' : 'home'));
  if (location.hash === '#analizar') show('app');
}

async function showPublicCounter(): Promise<void> {
  const stats = await fetchStats();
  if (stats && stats.totalAnalyses > 0) {
    const el = byId('counter');
    el.textContent = '';
    const b = document.createElement('b');
    b.textContent = stats.totalAnalyses.toLocaleString('es-ES');
    el.append('👻 ', b, ' análisis realizados');
  }
}

initRouter();
new Analyzer();
initFeedback();
animateGhost();
void showPublicCounter();
