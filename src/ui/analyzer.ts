import type { Network } from '../../shared/types';
import { NETWORK_CONFIG } from '../config/networks';
import { readUploads } from '../core/archive';
import { compare } from '../core/compare';
import { demoHistory, demoLists } from '../core/demo';
import { detectNetwork, exportDate, parseFiles } from '../core/parse';
import type { RawLists } from '../core/types';
import { snapshotOf } from '../core/history';
import { lang, onLangChange, t } from '../i18n';
import { trackEvent } from '../services/api';
import { clearHistory, recordAndCompare } from '../services/history';
import { byId, externalIcon, h } from './dom';
import { ResultsView } from './results';

/** Pantalla principal de análisis: selector de red, instrucciones, subida y resultados. */
export class Analyzer {
  private network: Network = 'instagram';
  private readonly results = new ResultsView();
  private readonly status = byId('status');

  constructor() {
    document.querySelectorAll<HTMLButtonElement>('.net').forEach((b) =>
      b.addEventListener('click', () => {
        this.setNetwork(b.dataset.net as Network);
        this.results.hide();
        this.setStatus('');
      }),
    );
    this.bindUpload();
    onLangChange(() => {
      this.setNetwork(this.network);
      if (this.status.classList.contains('err')) this.setStatus('');
    });
    byId('clearHistory').addEventListener('click', () => {
      void clearHistory(this.network).then(() => this.results.showHistory(null, false));
    });
    byId('demo').addEventListener('click', (e) => {
      e.stopPropagation();
      void trackEvent({ type: 'demo_used', network: this.network });
      this.finish(demoLists(this.network), false);
    });
    this.setNetwork('instagram');
  }

  setNetwork(network: Network): void {
    this.network = network;
    document.body.dataset.net = network;
    document.querySelectorAll('.net').forEach((b) =>
      b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.net === network)),
    );
    this.renderHowTo();
  }

  private renderHowTo(): void {
    const c = NETWORK_CONFIG[this.network];
    const box = byId('howto');
    const steps = h('ol');
    // Contenido estático definido en config/networks.ts (nunca texto del usuario).
    const text = c.text[lang()];
    for (const s of text.steps) {
      const li = h('li');
      li.innerHTML = s;
      steps.append(li);
    }
    const note = h('div', { class: 'note' });
    note.innerHTML = text.note;

    let link: HTMLAnchorElement | null = null;
    if (c.exportHref && text.exportLinkText) {
      link = h('a', { class: 'golink', href: c.exportHref, target: '_blank', rel: 'noopener noreferrer' }, text.exportLinkText);
      link.append(externalIcon());
    }
    box.replaceChildren(h('h3', {}, t('app.howto', { net: c.name })));
    if (link) box.append(link);
    box.append(steps, note);
  }

  private bindUpload(): void {
    const drop = byId('drop');
    const input = byId<HTMLInputElement>('file');
    drop.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id !== 'demo') input.click();
    });
    drop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });
    for (const ev of ['dragenter', 'dragover'] as const) {
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.add('over');
      });
    }
    for (const ev of ['dragleave', 'drop'] as const) {
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.remove('over');
      });
    }
    drop.addEventListener('drop', (e) => void this.handleFiles([...(e.dataTransfer?.files ?? [])]));
    input.addEventListener('change', () => {
      void this.handleFiles([...(input.files ?? [])]);
      input.value = '';
    });
  }

  private setStatus(message: string, isError = false): void {
    this.status.textContent = message;
    this.status.className = `status${isError ? ' err' : ''}`;
  }

  private async handleFiles(files: File[]): Promise<void> {
    if (!files.length) return;
    this.setStatus(t('status.analyzing'));
    try {
      const textFiles = await readUploads(files, this.network);
      this.finish(parseFiles(textFiles), true, exportDate(textFiles));
    } catch (err) {
      this.setStatus(t('status.cantOpen', { error: (err as Error).message }), true);
    }
  }

  private finish(lists: RawLists, real: boolean, date: number | null = null): void {
    if (!lists.followers.length || !lists.following.length) {
      const missing = [!lists.followers.length && t('status.yourFollowers'), !lists.following.length && t('status.yourFollowing')]
        .filter(Boolean)
.join(t('status.nor'));
      this.setStatus(
        t('status.missing', { missing, net: NETWORK_CONFIG[this.network].name }),
        true,
      );
      return;
    }
    // Si el archivo es claramente de otra red (X o TikTok), cambiamos solos.
    const detected = detectNetwork(lists);
    if (detected && detected !== this.network) this.setNetwork(detected);

    this.setStatus('');
    const data = compare(lists);
    this.results.show(data, this.network, date);
    if (!real) {
      this.results.showHistory(demoHistory(this.network, data), false, true);
      return;
    }
    void trackEvent({ type: 'analysis_completed', network: this.network });
    const network = this.network;
    void recordAndCompare(snapshotOf(network, data, date ?? Date.now())).then((diff) => {
      if (this.network === network) this.results.showHistory(diff, true);
    });
  }
}
