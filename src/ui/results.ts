import type { Network } from '../../shared/types';
import { NETWORK_CONFIG } from '../config/networks';
import { filterAndSort } from '../core/compare';
import { ageInDays, STALE_AFTER_DAYS } from '../core/parse';
import type { HistoryDiff } from '../core/history';
import type { Account, Comparison } from '../core/types';
import { locale, onLangChange, t } from '../i18n';
import type { StringKey } from '../i18n/strings';
import { byId, countUp, externalIcon, h } from './dom';

type Tab = 'notFollowingBack' | 'fans' | 'mutual' | 'lost' | 'gained';

const MAX_RENDERED = 1500;
// Dos tonos del naranja de la marca, siempre desde los tokens de CSS.
const PALETTE = ['var(--color-accent-2)', 'var(--color-accent-deep)'];
const ARC_LENGTH = 314.16;

const label = (a: Account): string => (a.handle ? `@${a.handle}` : t('res.account', { id: a.id ?? '?' }));
const emptyText = (tab: Tab) => t(`empty.${tab}` as StringKey);
const sinceText = (tab: Tab) => t(`since.${tab}` as StringKey);

function colorFor(key: string): string {
  let hash = 0;
  for (const c of key) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length]!;
}

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });

export class ResultsView {
  private data: Comparison | null = null;
  private history: HistoryDiff | null = null;
  private historySaved = false;
  private demo = false;
  private exportedAt: number | null = null;
  private network: Network = 'instagram';
  private tab: Tab = 'notFollowingBack';
  private readonly list = byId<HTMLUListElement>('list');
  private readonly search = byId<HTMLInputElement>('q');
  private readonly copyBtn = byId<HTMLButtonElement>('copy');

  constructor() {
    document.querySelectorAll<HTMLButtonElement>('.tab').forEach((t) =>
      t.addEventListener('click', () => this.select(t.dataset.k as Tab)),
    );
    document.querySelectorAll<HTMLElement>('[data-go]').forEach((s) =>
      s.addEventListener('click', () => {
        this.select(s.dataset.go as Tab);
        document.querySelector('.panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }),
    );
    this.search.addEventListener('input', () => this.render());
    this.copyBtn.addEventListener('click', () => void this.copy());
    onLangChange(() => this.relabel());
  }

  /** Vuelve a escribir los textos generados al cambiar de idioma, sin repetir animaciones. */
  private relabel(): void {
    if (!this.data) return;
    byId('resLabel').textContent = t('res.label', { net: NETWORK_CONFIG[this.network].name });
    this.showDataAge(this.exportedAt);
    if (this.history || this.historySaved) this.showHistory(this.history, this.historySaved, this.demo);
    this.render();
  }

  show(data: Comparison, network: Network, exportedAt: number | null = null): void {
    this.data = data;
    this.history = null;
    this.network = network;
    this.showHistory(null, false);
    this.search.value = '';
    const section = byId('results');
    section.classList.remove('hidden');
    this.exportedAt = exportedAt;
    byId('resLabel').textContent = t('res.label', { net: NETWORK_CONFIG[network].name });
    byId('xHint').classList.toggle('hidden', network !== 'x');
    byId('gone').classList.toggle('hidden', network === 'x');
    this.showDataAge(exportedAt);

    countUp(byId('sFollowers'), data.followers.size);
    countUp(byId('sFollowing'), data.following.size);
    countUp(byId('sNotBack'), data.notFollowingBack.length);
    countUp(byId('sFans'), data.fans.length);
    countUp(byId('pct'), data.followBackRate); // el % va aparte, en Chivo: Silkscreen lo dibuja como un 1
    byId('nNotBack').textContent = String(data.notFollowingBack.length);
    byId('nFans').textContent = String(data.fans.length);
    byId('nMutual').textContent = String(data.mutual.length);

    const arc = document.getElementById('arc') as SVGCircleElement | null;
    if (arc) {
      arc.style.strokeDashoffset = String(ARC_LENGTH);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => (arc.style.strokeDashoffset = String(ARC_LENGTH * (1 - data.followBackRate / 100)))),
      );
    }
    this.select('notFollowingBack');
    setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }

  private showDataAge(exportedAt: number | null): void {
    const el = byId('dataAge');
    if (!exportedAt) {
      el.classList.add('hidden');
      return;
    }
    const days = ageInDays(exportedAt);
    const when =
      days === 0 ? t('age.today') : days === 1 ? t('age.yesterday') : t('age.days', { n: days, date: fmtDate(exportedAt) });
    el.textContent = '';
    el.append(h('b', {}, t('age.exported', { when })));
    if (days >= STALE_AFTER_DAYS) {
      el.append(t('age.stale'));
    }
    el.classList.toggle('stale', days >= STALE_AFTER_DAYS);
    el.classList.remove('hidden');
  }

  /**
   * Muestra qué ha cambiado desde el último análisis guardado en este dispositivo.
   * `saved` indica si este análisis se ha guardado (no se guarda la demo).
   */
  showHistory(diff: HistoryDiff | null, saved: boolean, demo = false): void {
    this.history = diff;
    this.historySaved = saved;
    this.demo = demo;
    const box = byId('since');
    document.querySelectorAll('.tab--hist').forEach((t) => t.classList.toggle('hidden', !diff));
    if (!diff && !saved) {
      box.classList.add('hidden');
      if (this.tab === 'lost' || this.tab === 'gained') this.select('notFollowingBack');
      return;
    }
    box.classList.remove('hidden');
    box.classList.toggle('since--first', !diff);
    if (diff) {
      byId('sinceTitle').textContent = t('hist.title', { date: fmtDate(diff.previous.takenAt) });
      byId('sinceNote').textContent = t(this.demo ? 'hist.demoNote' : 'hist.note');
      countUp(byId('sLost'), diff.lost.length);
      countUp(byId('sGained'), diff.gained.length);
      byId('nLost').textContent = String(diff.lost.length);
      byId('nGained').textContent = String(diff.gained.length);
    } else {
      byId('sinceTitle').textContent = t('hist.firstTitle');
      byId('sinceNote').textContent = t('hist.firstNote');
    }
  }

  hide(): void {
    this.data = null;
    byId('results').classList.add('hidden');
  }

  private select(tab: Tab): void {
    this.tab = tab;
    document.querySelectorAll('.tab').forEach((t) =>
      t.setAttribute('aria-selected', String((t as HTMLElement).dataset.k === tab)),
    );
    this.render();
  }

  private source(): Account[] {
    if (!this.data) return [];
    if (this.tab === 'lost' || this.tab === 'gained') return this.history?.[this.tab] ?? [];
    return this.data[this.tab];
  }

  private visible(): Account[] {
    return filterAndSort(this.source(), this.search.value);
  }

  private row(a: Account, index: number): HTMLLIElement {
    const initial = (a.handle || '#')[0]!.toUpperCase();
    const inner = h('div', {}, initial);
    inner.style.background = colorFor(a.key);

    const link = h('a', { class: 'open', href: NETWORK_CONFIG[this.network].profileUrl(a), target: '_blank', rel: 'noopener noreferrer' }, t('res.profile'));
    link.append(externalIcon());

    const li = h(
      'li',
      {},
      h(
        'div',
        { class: 'user' },
        h('div', { class: 'av' }, inner),
        h('div', { class: 'user-text' }, h('div', { class: 'name' }, label(a)), a.ts ? h('div', { class: 'date' }, `${sinceText(this.tab)} ${fmtDate(a.ts)}`) : null),
      ),
      link,
    );
    li.style.animationDelay = `${Math.min(index, 20) * 18}ms`;
    return li;
  }

  private render(): void {
    if (!this.data) return;
    const items = this.visible();
    if (!items.length) {
      const searching = Boolean(this.search.value);
      this.list.replaceChildren(
        h('li', { class: 'empty' }, searching ? t('res.noMatch') : emptyText(this.tab)),
      );
      return;
    }
    const shown = items.slice(0, MAX_RENDERED);
    const rows: HTMLLIElement[] = shown.map((a, i) => this.row(a, i));
    if (items.length > shown.length) {
      rows.push(h('li', { class: 'empty' }, `…y ${items.length - shown.length} más. Usa el buscador.`));
    }
    this.list.replaceChildren(...rows);
  }

  private async copy(): Promise<void> {
    const text = this.visible().map(label).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      this.copyBtn.textContent = t('res.copied');
    } catch {
      this.copyBtn.textContent = t('res.copyFail');
    }
    setTimeout(() => (this.copyBtn.textContent = t('res.copy')), 1600);
  }
}
