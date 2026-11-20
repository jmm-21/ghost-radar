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
