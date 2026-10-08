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

test('hayPalabraPosible: poda eficaz en tablero grande', () => {
  const rng = crearRng(42);
  const lista = [];
  for (const c of [{ q: 0, r: 0 }, ...[1, 2, 3, 4, 5].flatMap((n) => anillo(n))]) {
    lista.push({ q: c.q, r: c.r, letra: rng() < 0.5 ? 'a' : 'b' });
  }
  assert.equal(lista.length, 91);
  const t = tableroDesde(lista);
  // Palabras largas de a/b con prefijos alcanzables, pero acabadas en 'c' (inexistente).
  const palabras = new Set();
  const r2 = crearRng(7);
  while (palabras.size < 450) {
    const n = 10 + Math.floor(r2() * 5);
    let p = '';
    for (let i = 0; i < n; i++) p += r2() < 0.5 ? 'a' : 'b';
    palabras.add(p + 'c');
  }
  const lemNo = cargarLemario([...palabras].join('\n'));
  let t0 = Date.now();
  assert.equal(hayPalabraPosible(t, lemNo), false);
  assert.ok(Date.now() - t0 < 2000, 'demasiado lento');
  const todasA = tableroDesde(lista.map((c) => ({ ...c, letra: 'a' })));
  const lemA = cargarLemario([...palabras, 'a'.repeat(12)].join('\n'));
  t0 = Date.now();
  assert.equal(hayPalabraPosible(todasA, lemA), true);
  assert.equal(hayPalabraPosible(todasA, lemNo), false);
  assert.ok(Date.now() - t0 < 2000, 'demasiado lento');
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

test('garantizarPalabraPosible: ignora casillas congeladas', () => {
  const t = tableroDesde([
    { q: 0, r: 0, letra: 'x' }, { q: 1, r: 0, letra: 'x' }, { q: 0, r: 1, letra: 'x' },
  ]);
  t.casilla(1, 0).congeladaHasta = 5;
  const l = lem('sol');
  assert.equal(garantizarPalabraPosible(t, l, crearRng(1)), false);
  assert.equal(hayPalabraPosible(t, l), false);
  assert.equal(t.casilla(0, 0).letra, 'x');
});

test('crearTableroInicial', () => {
  const t = crearTableroInicial(lem('sol'), crearRng(7));
  const esperadas = [clave(0, 0), ...anillo(1).map((c) => clave(c.q, c.r))].sort();
  assert.deepEqual([...t.casillas.keys()].sort(), esperadas);
  for (const c of t.casillas.values()) assert.equal(c.letra.length, 1);
  assert.equal(hayPalabraPosible(t, lem('sol')), true);
});
