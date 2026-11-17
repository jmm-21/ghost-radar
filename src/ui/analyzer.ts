import type { Network } from '../../shared/types';
import { NETWORK_CONFIG } from '../config/networks';
import { readUploads } from '../core/archive';
import { compare } from '../core/compare';
import { demoLists } from '../core/demo';
import { detectNetwork, parseFiles } from '../core/parse';
import type { RawLists } from '../core/types';
import { trackEvent } from '../services/api';
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
    for (const s of c.steps) {
      const li = h('li');
      li.innerHTML = s;
      steps.append(li);
    }
    const note = h('div', { class: 'note' });
    note.innerHTML = c.note;

    let link: HTMLAnchorElement | null = null;
    if (c.exportLink) {
      link = h('a', { class: 'golink', href: c.exportLink.href, target: '_blank', rel: 'noopener noreferrer' }, c.exportLink.text);
      link.append(externalIcon());
    }
    box.replaceChildren(h('h3', {}, `Descarga tus datos de ${c.name}`));
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
    this.setStatus('Analizando…');
    try {
      const textFiles = await readUploads(files, this.network);
      this.finish(parseFiles(textFiles), true);
    } catch (err) {
      this.setStatus(`No he podido abrir el archivo: ${(err as Error).message}`, true);
    }
  }

  private finish(lists: RawLists, real: boolean): void {
    if (!lists.followers.length || !lists.following.length) {
      const missing = [!lists.followers.length && 'tus seguidores', !lists.following.length && 'tus seguidos']
        .filter(Boolean)
        .join(' ni ');
      this.setStatus(
        `No encuentro ${missing} en el archivo. ¿Es la descarga de ${NETWORK_CONFIG[this.network].name} y marcaste “Seguidores y seguidos”?`,
        true,
      );
      return;
    }
    // Si el archivo es claramente de otra red (X o TikTok), cambiamos solos.
    const detected = detectNetwork(lists);
    if (detected && detected !== this.network) this.setNetwork(detected);

    this.setStatus('');
    this.results.show(compare(lists), this.network);
    if (real) void trackEvent({ type: 'analysis_completed', network: this.network });
  }
}
