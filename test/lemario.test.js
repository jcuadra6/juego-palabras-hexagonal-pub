import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizar, cargarLemario } from '../src/lemario.js';
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
