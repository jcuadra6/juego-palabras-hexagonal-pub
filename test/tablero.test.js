import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Tablero, tableroDesde, caminoValido, palabraDeCamino,
  hayPalabraPosible, garantizarPalabraPosible, crearTableroInicial,
} from '../src/tablero.js';
import { cargarLemario } from '../src/lemario.js';
import { crearRng } from '../src/rng.js';
import { clave, anillo } from '../src/hex.js';

const A = { q: 0, r: 0 };
const B = { q: 1, r: 0 };
const lem = (...p) => cargarLemario(p.join('\n'));

test('caminoValido: corto', () => {
  const t = tableroDesde([{ q: 0, r: 0, letra: 'a' }, { q: 1, r: 0, letra: 'l' }]);
  assert.deepEqual(caminoValido(t, []), { valido: false, motivo: 'corto' });
  assert.equal(caminoValido(t, [A, B]).motivo, 'corto');
});

test('caminoValido: no-vecinas', () => {
  const t = tableroDesde([
    { q: 0, r: 0, letra: 'a' }, { q: 1, r: 1, letra: 'b' }, { q: 1, r: 0, letra: 'c' },
  ]);
  assert.equal(caminoValido(t, [A, { q: 1, r: 1 }, B]).motivo, 'no-vecinas');
});

test('caminoValido: repetida consecutiva y no existe', () => {
  const t = tableroDesde([{ q: 0, r: 0, letra: 'a' }, { q: 1, r: 0, letra: 'l' }]);
  assert.equal(caminoValido(t, [A, A, B]).motivo, 'repetida-consecutiva');
  assert.equal(caminoValido(t, [A, B, { q: 5, r: 5 }]).motivo, 'no-existe');
});

test('caminoValido: A,B,A valido; congelada', () => {
  const t = tableroDesde([{ q: 0, r: 0, letra: 'a' }, { q: 1, r: 0, letra: 'l' }]);
  assert.deepEqual(caminoValido(t, [A, B, A]), { valido: true });
  t.casilla(1, 0).congeladaHasta = 3;
  t.turno = 2;
  assert.equal(caminoValido(t, [A, B, A]).motivo, 'congelada');
  t.turno = 3;
  assert.equal(caminoValido(t, [A, B, A]).valido, true);
});

test('palabraDeCamino', () => {
  const t = tableroDesde([{ q: 0, r: 0, letra: 'a' }, { q: 1, r: 0, letra: 'l' }]);
  assert.equal(palabraDeCamino(t, [A, B, A]), 'ala');
});

test('hayPalabraPosible', () => {
  const t = tableroDesde([{ q: 0, r: 0, letra: 'a' }, { q: 1, r: 0, letra: 'l' }]);
  assert.equal(hayPalabraPosible(t, lem('ala')), true);
  assert.equal(hayPalabraPosible(t, lem('alma')), false);
  t.casilla(1, 0).congeladaHasta = 5;
  assert.equal(hayPalabraPosible(t, lem('ala')), false);
});

test('hayPalabraPosible: rapido en tablero grande', () => {
  const lista = [];
  for (let r = 0; r <= 4; r++) for (let q = 0; q <= 4; q++) lista.push({ q, r, letra: 'a' });
  const t = tableroDesde(lista);
  const palabras = [];
  for (let i = 0; i < 450; i++) palabras.push('b' + 'xyz'[i % 3] + String(i).replace(/\d/g, (d) => 'cdefghijkl'[d]));
  const t0 = Date.now();
  assert.equal(hayPalabraPosible(t, cargarLemario(palabras.join('\n'))), false);
  assert.ok(Date.now() - t0 < 1000);
});

test('garantizarPalabraPosible', () => {
  const t = tableroDesde([
    { q: 0, r: 0, letra: 'x' }, { q: 1, r: 0, letra: 'x' }, { q: 0, r: 1, letra: 'x' },
  ]);
  const l = lem('sol');
  assert.equal(garantizarPalabraPosible(t, l, crearRng(1)), true);
  assert.equal(hayPalabraPosible(t, l), true);
  const t2 = tableroDesde([{ q: 0, r: 0, letra: 'x' }, { q: 1, r: 0, letra: 'x' }]);
  assert.equal(garantizarPalabraPosible(t2, l, crearRng(1)), false);
  assert.equal(garantizarPalabraPosible(t, lem('alma'), crearRng(1)), false); // sin palabras de 3 letras
});

test('crearTableroInicial', () => {
  const t = crearTableroInicial(lem('sol'), crearRng(7));
  const esperadas = [clave(0, 0), ...anillo(1).map((c) => clave(c.q, c.r))].sort();
  assert.deepEqual([...t.casillas.keys()].sort(), esperadas);
  for (const c of t.casillas.values()) assert.equal(c.letra.length, 1);
  assert.equal(hayPalabraPosible(t, lem('sol')), true);
});
