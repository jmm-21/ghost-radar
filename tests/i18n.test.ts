import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NETWORK_CONFIG } from '../src/config/networks';
import { detectLang, LANGS, t, VIDEOS } from '../src/i18n';
import { STRINGS } from '../src/i18n/strings';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('idiomas', () => {
  it('elige el idioma guardado, o el del navegador', () => {
    expect(detectLang('en', ['es-ES'])).toBe('en');
    expect(detectLang(null, ['es-MX', 'en'])).toBe('es');
    expect(detectLang(null, ['de-DE'])).toBe('en');
    expect(detectLang('fr', [])).toBe('es');
  });

  it('sustituye los huecos', () => {
    expect(t('res.label', { net: 'TikTok' }, 'es')).toBe('Tus resultados en TikTok');
    expect(t('res.label', { net: 'TikTok' }, 'en')).toBe('Your TikTok results');
  });

  it('ningún texto se queda vacío ni sin traducir', () => {
    for (const lang of LANGS) {
      for (const [key, value] of Object.entries(STRINGS[lang])) expect(value.trim(), `${lang}:${key}`).not.toBe('');
    }
    const same = Object.keys(STRINGS.es).filter(
      (k) => STRINGS.es[k as keyof typeof STRINGS.es] === STRINGS.en[k as keyof typeof STRINGS.en],
    );
    expect(same).toEqual([]);
  });

  it('cada clave usada en index.html existe', () => {
    const keys = [...html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map((m) => m[1]!);
    expect(keys.length).toBeGreaterThan(60);
    for (const k of keys) expect(STRINGS.es, k).toHaveProperty([k]);
  });

  it('el texto del HTML coincide con el español, para que no haya saltos al cargar', () => {
    for (const m of html.matchAll(/data-i18n="([^"]+)">([^<]*)</g)) {
      const es = STRINGS.es[m[1] as keyof typeof STRINGS.es];
      if (es.includes('<')) expect(html, m[1]).toContain(`data-i18n="${m[1]}">${es}<`);
      else expect(m[2], m[1]).toBe(es);
    }
  });

  it('cada red tiene las instrucciones en los dos idiomas', () => {
    for (const net of Object.values(NETWORK_CONFIG)) {
      expect(net.text.en.steps.length).toBe(net.text.es.steps.length);
      expect(Boolean(net.text.en.exportLinkText)).toBe(Boolean(net.text.es.exportLinkText));
    }
  });
});

describe('vídeos', () => {
  it('cada vídeo de la web existe en los dos idiomas, con su portada', async () => {
    const { existsSync } = await import('node:fs');
    const names = new Set([...html.matchAll(/data-video="([^"]+)"/g)].map((m) => m[1]!));
    for (const net of Object.values(NETWORK_CONFIG)) if (net.video) names.add(net.video);
    expect(names.size).toBeGreaterThan(0);
    // Todo vídeo usado en la página tiene que estar en la lista fija de i18n.
    for (const name of names) expect(VIDEOS).toContain(name);
    for (const name of names) {
      for (const lang of LANGS) {
        for (const ext of ['mp4', 'jpg']) {
          const file = new URL(`../public/videos/${name}-${lang}.${ext}`, import.meta.url);
          expect(existsSync(file), `${name}-${lang}.${ext}`).toBe(true);
        }
      }
    }
  });
});
