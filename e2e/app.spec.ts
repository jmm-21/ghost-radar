import { expect, test, type Page } from '@playwright/test';
import JSZip from 'jszip';

// El backend (/api) no existe en `vite preview`: respondemos nosotros para que los tests no dependan de él.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) => route.fulfill({ status: 200, json: { ok: true, analyses: 0 } }));
});

const entry = (handle: string) => ({
  title: '',
  string_list_data: [{ href: `https://www.instagram.com/${handle}`, value: handle, timestamp: 1_763_000_000 }],
});

/** Crea en memoria un .zip con la misma estructura que la descarga oficial de Instagram. */
async function instagramZip(followers: string[], following: string[], date = new Date()): Promise<Buffer> {
  const zip = new JSZip();
  const dir = 'connections/followers_and_following/';
  zip.file(`${dir}followers_1.json`, JSON.stringify(followers.map(entry)), { date });
  zip.file(`${dir}following.json`, JSON.stringify({ relationships_following: following.map(entry) }), { date });
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function openTool(page: Page) {
  await page.goto('/');
  await page.locator('#start').click();
  await expect(page.locator('#appView')).toBeVisible();
}

test('la portada carga y lleva a la herramienta', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/ghost radar/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('¿Quién no me sigue');
  await page.locator('#start').click();
  await expect(page).toHaveURL(/#analizar/);
  await expect(page.getByRole('heading', { name: '¿Qué red quieres analizar?' })).toBeVisible();
});

test('analiza un .zip de Instagram y calcula las tres listas', async ({ page }) => {
  await openTool(page);
  const zip = await instagramZip(['ana', 'luis', 'marta'], ['ana', 'luis', 'pepe', 'lola']);
  await page.locator('#file').setInputFiles({ name: 'instagram.zip', mimeType: 'application/zip', buffer: zip });

  await expect(page.locator('#results')).toBeVisible();
  await expect(page.locator('#sFollowers')).toHaveText('3');
  await expect(page.locator('#sFollowing')).toHaveText('4');
  await expect(page.locator('#nNotBack')).toHaveText('2');
  await expect(page.locator('#nFans')).toHaveText('1');
  await expect(page.locator('#nMutual')).toHaveText('2');
  await expect(page.locator('#list')).toContainText('pepe');
  await expect(page.locator('#list')).toContainText('lola');

  await page.locator('.tab[data-k="fans"]').click();
  await expect(page.locator('#list')).toContainText('marta');
});

test('el buscador filtra la lista', async ({ page }) => {
  await openTool(page);
  const zip = await instagramZip(['ana'], ['ana', 'pepe', 'lola']);
  await page.locator('#file').setInputFiles({ name: 'instagram.zip', mimeType: 'application/zip', buffer: zip });
  await page.locator('#q').fill('lol');
  await expect(page.locator('#list')).toContainText('lola');
  await expect(page.locator('#list')).not.toContainText('pepe');
});

test('avisa si el archivo no trae seguidores', async ({ page }) => {
  await openTool(page);
  const zip = new JSZip();
  zip.file('otra_cosa.json', '{}');
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await page.locator('#file').setInputFiles({ name: 'vacio.zip', mimeType: 'application/zip', buffer });
  await expect(page.locator('#status')).toContainText('No encuentro');
  await expect(page.locator('#results')).toBeHidden();
});

test('los datos de ejemplo funcionan en todas las redes', async ({ page }) => {
  await openTool(page);
  for (const net of ['instagram', 'tiktok', 'x', 'threads']) {
    await page.locator(`.net[data-net="${net}"]`).click();
    await expect(page.locator(`.net[data-net="${net}"]`)).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#demo').click();
    await expect(page.locator('#results')).toBeVisible();
    await expect(page.locator('#list li').first()).toBeVisible();
  }
});

test('el archivo nunca sale del navegador', async ({ page }) => {
  const uploads: string[] = [];
  page.on('request', (req) => {
    if (req.method() !== 'GET' && (req.postData()?.length ?? 0) > 2000) uploads.push(req.url());
  });
  await openTool(page);
  const many = Array.from({ length: 500 }, (_, i) => `cuenta_${i}`);
  const zip = await instagramZip(many, many.slice(0, 300));
  await page.locator('#file').setInputFiles({ name: 'instagram.zip', mimeType: 'application/zip', buffer: zip });
  await expect(page.locator('#results')).toBeVisible();
  expect(uploads).toEqual([]);
});

test('recuerda el análisis anterior y dice quién te ha dejado de seguir', async ({ page }) => {
  await openTool(page);
  const day = 864e5;
  const first = await instagramZip(['ana', 'luis', 'pepe'], ['ana'], new Date(Date.now() - 14 * day));
  await page.locator('#file').setInputFiles({ name: 'a.zip', mimeType: 'application/zip', buffer: first });
  await expect(page.locator('#since')).toBeVisible();
  await expect(page.locator('#sinceTitle')).toHaveText('Guardado en este dispositivo');
  await expect(page.locator('.tab[data-k="lost"]')).toBeHidden();

  // Segunda exportación, más reciente: luis se ha ido y marta ha llegado.
  const second = await instagramZip(['ana', 'pepe', 'marta'], ['ana'], new Date(Date.now() - day));
  await page.locator('#file').setInputFiles({ name: 'b.zip', mimeType: 'application/zip', buffer: second });
  await expect(page.locator('#sinceTitle')).toContainText('Desde tu análisis del');
  await expect(page.locator('#nLost')).toHaveText('1');
  await expect(page.locator('#nGained')).toHaveText('1');
  await page.locator('[data-go="lost"]').click();
  await expect(page.locator('#list')).toContainText('luis');
  await page.locator('.tab[data-k="gained"]').click();
  await expect(page.locator('#list')).toContainText('marta');

  await page.locator('#clearHistory').click();
  await expect(page.locator('#since')).toBeHidden();
  await expect(page.locator('.tab[data-k="lost"]')).toBeHidden();
});

test('la demo enseña cómo se ve el historial', async ({ page }) => {
  await openTool(page);
  await page.locator('#demo').click();
  await expect(page.locator('#since')).toBeVisible();
  await expect(page.locator('#nLost')).toHaveText('3');
});

test('cambia a inglés, traduce todo y lo recuerda', async ({ page }) => {
  await page.goto('/');
  await page.locator('.bar--home select[data-lang]').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Who isn’t following');
  await expect(page).toHaveTitle(/Who isn’t following me back/);
  await page.locator('#start').click();
  await expect(page.getByRole('heading', { name: 'Which network do you want to analyze?' })).toBeVisible();
  await expect(page.locator('#howto h3')).toHaveText('Download your Instagram data');
  await expect(page.locator('.bar--app select[data-lang]')).toHaveValue('en');

  await page.locator('#demo').click();
  await expect(page.locator('#resLabel')).toHaveText('Your Instagram results');
  await expect(page.locator('#list a.open').first()).toContainText('View profile');

  // Al cambiar con resultados en pantalla, también se traducen.
  await page.locator('.bar--app select[data-lang]').selectOption('es');
  await expect(page.locator('#resLabel')).toHaveText('Tus resultados en Instagram');
  await expect(page.locator('#list a.open').first()).toContainText('Ver perfil');

  await page.locator('.bar--app select[data-lang]').selectOption('en');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#howto h3')).toHaveText('Download your Instagram data');
});

test.describe('con el navegador en inglés', () => {
  test.use({ locale: 'en-US' });
  test('abre directamente en inglés', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#start')).toHaveText('Get started');
  });
});

test('las capturas de la portada cambian de idioma', async ({ page }) => {
  await page.goto('/');
  const shot = page.locator('.showcase img');
  await expect(shot).toHaveAttribute('src', '/screens/resultados.png');
  await page.locator('.bar--home select[data-lang]').selectOption('en');
  await expect(shot).toHaveAttribute('src', '/screens/en/resultados.png');
  expect(await shot.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
});

test('el vídeo de exportar se abre desde las instrucciones de Instagram', async ({ page }) => {
  await openTool(page);
  await page.locator('#watchVideo').click();
  const dialog = page.locator('#videoDialog');
  await expect(dialog).toBeVisible();
  const video = page.locator('#exportVideo');
  await expect(video).toHaveAttribute('src', '/videos/exportar-instagram-es.mp4');
  // El vídeo existe y el navegador puede leerlo.
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThan(0);
  expect(await video.evaluate((v: HTMLVideoElement) => v.duration)).toBeGreaterThan(30);
  await page.locator('#videoClose').click();
  await expect(dialog).toBeHidden();
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);

  // Solo Instagram tiene vídeo por ahora.
  await page.locator('.net[data-net="tiktok"]').click();
  await expect(page.locator('#watchVideo')).toHaveCount(0);
});

test('los vídeos cambian de idioma', async ({ page }) => {
  await page.goto('/');
  const tutorial = page.locator('video[data-video="tutorial"]');
  await expect(tutorial).toHaveAttribute('src', '/videos/tutorial-es.mp4');
  await page.locator('.bar--home select[data-lang]').selectOption('en');
  await expect(tutorial).toHaveAttribute('src', '/videos/tutorial-en.mp4');
  await expect(tutorial).toHaveAttribute('poster', '/videos/tutorial-en.jpg');
  await expect(page.locator('#exportVideo')).toHaveAttribute('src', '/videos/exportar-instagram-en.mp4');
  for (const url of ['/videos/tutorial-en.mp4', '/videos/tutorial-en.jpg', '/videos/exportar-instagram-en.mp4']) {
    expect((await page.request.head(url)).status(), url).toBe(200);
  }
});

test.describe('app instalable y sin conexión', () => {
  /** Espera a que el service worker controle la página y tenga la web guardada. */
  async function waitForServiceWorker(page: Page) {
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
      }
    });
  }

  test('el manifest permite instalarla y recibir archivos compartidos', async ({ page }) => {
    const res = await page.request.get('/manifest.webmanifest');
    expect(res.ok()).toBe(true);
    const manifest = await res.json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/#analizar');
    const sizes = manifest.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`);
    expect(sizes).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']));
    for (const icon of manifest.icons) expect((await page.request.head(icon.src)).status(), icon.src).toBe(200);
    expect(manifest.share_target).toMatchObject({ action: '/compartir', method: 'POST', enctype: 'multipart/form-data' });
  });

  test('Chrome la considera instalable', async ({ page, context }) => {
    await page.goto('/');
    await waitForServiceWorker(page);
    const cdp = await context.newCDPSession(page);
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
    // El navegador de los tests es "de incógnito", donde nunca se instala nada: ese motivo se ignora.
    expect(installabilityErrors.filter((e) => e.errorId !== 'in-incognito')).toEqual([]);
  });

  test('sin conexión la web carga y analiza igual', async ({ page, context }) => {
    await page.goto('/');
    await waitForServiceWorker(page);

    await context.setOffline(true);
    await page.goto('/#analizar');
    await expect(page.getByRole('heading', { name: '¿Qué red quieres analizar?' })).toBeVisible();
    await expect(page.locator('#offline')).toBeVisible();

    const zip = await instagramZip(['ana', 'luis'], ['ana', 'pepe']);
    await page.locator('#file').setInputFiles({ name: 'instagram.zip', mimeType: 'application/zip', buffer: zip });
    await expect(page.locator('#nNotBack')).toHaveText('1');
    await expect(page.locator('#list')).toContainText('pepe');

    await context.setOffline(false);
    await expect(page.locator('#offline')).toBeHidden();
  });

  test('"Compartir → ghost.radar" analiza el archivo directamente', async ({ page }) => {
    await page.goto('/');
    await waitForServiceWorker(page);

    // Simula lo que hace Android al compartir: un POST multipart a /compartir.
    await page.evaluate(() => {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/compartir';
      form.enctype = 'multipart/form-data';
      const input = document.createElement('input');
      input.type = 'file';
      input.name = 'archivos';
      input.id = 'shareInput';
      form.append(input);
      document.body.append(form);
    });
    const zip = await instagramZip(['ana', 'luis', 'marta'], ['ana', 'pepe']);
    await page.locator('#shareInput').setInputFiles({ name: 'instagram.zip', mimeType: 'application/zip', buffer: zip });
    await page.evaluate(() => document.querySelector<HTMLFormElement>('form[action="/compartir"]')!.submit());

    await expect(page).toHaveURL(/#analizar$/);
    expect(page.url()).not.toContain('compartido');
    await expect(page.locator('#results')).toBeVisible();
    await expect(page.locator('#nNotBack')).toHaveText('1');
    await expect(page.locator('#nFans')).toHaveText('2');
  });
});

test.describe('en iPhone', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });
  test('explica cómo instalarla desde Compartir', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#iosHint')).toBeVisible();
    await expect(page.locator('#install')).toBeHidden();
  });
});
