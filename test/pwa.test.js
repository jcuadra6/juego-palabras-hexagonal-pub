import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const raiz = new URL('../', import.meta.url);
const leer = (ruta) => readFileSync(new URL(ruta, raiz), 'utf8');

function archivosDelServiceWorker() {
  const bloque = leer('sw.js').match(/const ARCHIVOS = \[([\s\S]*?)\];/)[1];
  return [...bloque.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test('el service worker guarda todo el código, los datos y los iconos', () => {
  const guardados = new Set(archivosDelServiceWorker());
  const necesarios = [
    'index.html', 'styles.css', 'manifest.webmanifest',
    ...readdirSync(new URL('src/', raiz)).map((f) => `src/${f}`),
    ...readdirSync(new URL('data/temas/', raiz)).map((f) => `data/temas/${f}`),
    ...readdirSync(new URL('iconos/', raiz)).map((f) => `iconos/${f}`),
    ...readdirSync(new URL('data/tematicas/', raiz)).map((f) => `data/tematicas/${f}`),
    'data/lemario.txt',
  ];
  for (const f of necesarios) assert.ok(guardados.has(f), `falta ${f} en sw.js`);
});

test('cada archivo que guarda el service worker existe', () => {
  for (const f of archivosDelServiceWorker()) {
    if (f === './') continue;
    assert.ok(existsSync(new URL(f, raiz)), `${f} no existe`);
  }
});

test('el manifiesto es instalable y sus iconos existen', () => {
  const m = JSON.parse(leer('manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  assert.ok(m.name && m.short_name && m.start_url);
  const tamanos = m.icons.map((i) => i.sizes);
  assert.ok(tamanos.includes('192x192') && tamanos.includes('512x512'));
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  for (const i of m.icons) assert.ok(existsSync(new URL(i.src, raiz)), `${i.src} no existe`);
});
