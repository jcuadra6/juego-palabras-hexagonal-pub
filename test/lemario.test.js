import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizar, normalizarEtiqueta, cargarLemario } from '../src/lemario.js';
import { prepararLemario } from '../scripts/preparar-lemario.mjs';
import { crearRng } from '../src/rng.js';
import { FRECUENCIAS_LETRAS } from '../src/config.js';

test('normalizar quita tildes y diéresis y conserva la ñ', () => {
  assert.equal(normalizar('ÁRBOL'), 'arbol');
  assert.equal(normalizar('Año'), 'año');
  assert.equal(normalizar('pingüino'), 'pinguino');
});

test('cargarLemario filtra líneas inválidas', () => {
  const l = cargarLemario('Casa\r\n\n  perro  \nÁrbol\nab\nco2\nabc-d');
  assert.equal(l.existe('casa'), true);
  assert.equal(l.existe('ARBOL'), true);
  assert.equal(l.existe('perro'), true);
  assert.equal(l.existe('ab'), false);
  assert.equal(l.existe('co2'), false);
  assert.equal(l.existe('abc-d'), false);
  assert.equal(l.tamano, 3);
});

test('esPrefijo', () => {
  const l = cargarLemario('casa\nperro');
  assert.equal(l.esPrefijo('pe'), true);
  assert.equal(l.esPrefijo('pz'), false);
  assert.equal(l.esPrefijo(''), true);
});

test('letraAleatoria es ponderada', () => {
  const l = cargarLemario('casa');
  const rng = crearRng(1);
  const cuenta = {};
  for (let i = 0; i < 2000; i++) {
    const c = l.letraAleatoria(rng);
    assert.ok(c in FRECUENCIAS_LETRAS);
    cuenta[c] = (cuenta[c] ?? 0) + 1;
  }
  assert.ok((cuenta.e ?? 0) > (cuenta.z ?? 0));
});

test('palabraAleatoria', () => {
  const rng = crearRng(2);
  assert.equal(cargarLemario('sol\ncasa').palabraAleatoria(rng, 3), 'sol');
  assert.equal(cargarLemario('casa').palabraAleatoria(rng, 3), null);
});

test('lemario de muestra tiene al menos 300 palabras', () => {
  const l = cargarLemario(readFileSync(new URL('../data/lemario-muestra.txt', import.meta.url), 'utf8'));
  assert.ok(l.tamano >= 300);
  for (const p of ['bruja', 'navidad', 'sol', 'ala', 'casa', 'perro', 'mesa']) assert.ok(l.existe(p), p);
});

test('cargarLemario lee etiquetas tras «;» y junta las de palabras repetidas', () => {
  const l = cargarLemario('calabaza;Halloween, otoño\nbruja;halloween\ncasa\nCalabaza;fiesta\nxx;halloween\nsol;');
  assert.equal(l.existe('calabaza'), true);
  assert.equal(l.existe('casa'), true);
  assert.equal(l.tamano, 4);
  assert.deepEqual(l.listaEtiquetas, ['fiesta', 'halloween', 'otoño']);
  assert.deepEqual(l.palabrasDeEtiqueta('HALLOWEEN'), ['calabaza', 'bruja']);
  assert.deepEqual(l.palabrasDeEtiqueta('otono'), []);
  assert.deepEqual(l.palabrasDeEtiqueta('fiesta'), ['calabaza']);
  assert.deepEqual(cargarLemario('sol\nmar').listaEtiquetas, []);
});

test('normalizarEtiqueta', () => {
  assert.equal(normalizarEtiqueta('  Día   de  Muertos '), 'dia de muertos');
  assert.equal(normalizarEtiqueta('Otoño'), 'otoño');
});

test('prepararLemario descarta afijos, locuciones, nombres propios y siglas', () => {
  const texto = 'a\na-\n-able\nab initio\nAbraham\nADN\nÁrbol\naba\nárbol\npingüino\nniño\nab\n';
  assert.deepEqual(prepararLemario(texto), ['aba', 'arbol', 'niño', 'pinguino']);
});

test('el lemario por defecto es grande, ordenado y ya normalizado', () => {
  const texto = readFileSync(new URL('../data/lemario.txt', import.meta.url), 'utf8');
  const lineas = texto.trimEnd().split(/\r?\n/);
  assert.ok(lineas.length > 80000);
  assert.deepEqual(cargarLemario(texto).palabras, lineas);
  for (const p of ['calabaza', 'bruja', 'murcielago', 'niño', 'pinguino', 'jugar']) assert.ok(lineas.includes(p), p);
  assert.ok(!lineas.includes('abraham'));
});

test('palabrasDeLongitud devuelve las palabras de esa longitud en orden de inserción', () => {
  const l = cargarLemario('sol\nsola\nmesa\ncasa');
  assert.deepEqual(l.palabrasDeLongitud(4), ['sola', 'mesa', 'casa']);
  assert.deepEqual(l.palabrasDeLongitud(3), ['sol']);
  assert.deepEqual(l.palabrasDeLongitud(9), []);
});

test('siguientesLetras devuelve las letras que continúan el prefijo', () => {
  const l = cargarLemario('sol\nsola\nmesa\ncasa');
  assert.deepEqual(l.siguientesLetras('so'), ['l']);
  assert.deepEqual(l.siguientesLetras(''), ['c', 'm', 's']);
  assert.deepEqual(l.siguientesLetras('zz'), []);
  assert.deepEqual(l.siguientesLetras('SÓ'), ['l']);
});

test('frecuenciaPar cuenta las veces que una letra precede a otra', () => {
  const l = cargarLemario('sol\nsola\nmesa\ncasa');
  assert.equal(l.frecuenciaPar('s', 'o'), 2);
  assert.equal(l.frecuenciaPar('o', 'l'), 2);
  assert.equal(l.frecuenciaPar('s', 'a'), 2);
  assert.equal(l.frecuenciaPar('a', 's'), 1);
  assert.equal(l.frecuenciaPar('z', 'x'), 0);
});

test('longitudMaxima', () => {
  assert.equal(cargarLemario('sol\nsola\nmesa\ncasa').longitudMaxima, 4);
});

test('lemario vacío', () => {
  const l = cargarLemario('');
  assert.equal(l.longitudMaxima, 0);
  assert.deepEqual(l.palabrasDeLongitud(3), []);
  assert.deepEqual(l.siguientesLetras(''), []);
});
