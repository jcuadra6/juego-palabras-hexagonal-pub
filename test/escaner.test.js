import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escanearPalabras } from '../src/escaner.js';
import { tableroDesde, caminoValido, palabraDeCamino } from '../src/tablero.js';
import { cargarLemario } from '../src/lemario.js';
import { normalizarConfig } from '../src/config.js';
import { sembrarTablero } from '../src/siembra.js';
import { crearRng } from '../src/rng.js';
import { clave } from '../src/hex.js';
import { lemarioSintetico } from './helpers.js';

const lem = (...p) => cargarLemario(p.join('\n'));
const basico = () => tableroDesde([{ q: 0, r: 0, letra: 'a' }, { q: 1, r: 0, letra: 'l' }]);

test('caso básico: una palabra con su camino y su puntuación', () => {
  const r = escanearPalabras(basico(), lem('ala'));
  assert.deepStrictEqual(r, {
    palabras: [{ palabra: 'ala', camino: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 0 }], puntos: 9 }],
    truncado: false,
  });
});

test('orden: puntuación descendente y luego alfabético', () => {
  const t = tableroDesde([
    { q: 0, r: 0, letra: 's' }, { q: 1, r: 0, letra: 'o' },
    { q: 2, r: 0, letra: 'l' }, { q: 2, r: -1, letra: 'a' },
  ]);
  const r = escanearPalabras(t, lem('sol', 'sola', 'ola'));
  assert.deepStrictEqual(r.palabras.map((p) => p.palabra), ['sola', 'ola', 'sol']);
  assert.deepStrictEqual(r.palabras.map((p) => p.puntos), [16, 9, 9]);
});

test('cada palabra una sola vez, con preferencia por el camino sin repeticiones', () => {
  const t = tableroDesde([
    { q: 0, r: 0, letra: 'a' }, { q: 1, r: 0, letra: 'b' }, { q: 0, r: 1, letra: 'a' },
  ]);
  const r = escanearPalabras(t, lem('aba'));
  assert.equal(r.palabras.length, 1);
  assert.equal(r.palabras[0].palabra, 'aba');
  assert.equal(new Set(r.palabras[0].camino.map((c) => clave(c.q, c.r))).size, 3);
});

test('excluir quita las palabras indicadas', () => {
  const r = escanearPalabras(basico(), lem('ala'), { excluir: new Set(['ala']) });
  assert.deepStrictEqual(r, { palabras: [], truncado: false });
});

test('las casillas congeladas no se usan', () => {
  const t = basico();
  t.casilla(1, 0).congeladaHasta = t.turno + 2;
  assert.deepStrictEqual(escanearPalabras(t, lem('ala')).palabras, []);
});

test('las casillas ocultas se usan con su letra real', () => {
  const t = basico();
  t.casilla(0, 0).ocultaHasta = t.turno + 2;
  assert.equal(escanearPalabras(t, lem('ala')).palabras[0].palabra, 'ala');
});

test('la eñe se trata como letra propia', () => {
  const t = tableroDesde([
    { q: 0, r: 0, letra: 'a' }, { q: 1, r: 0, letra: 'ñ' }, { q: 2, r: 0, letra: 'o' },
  ]);
  assert.equal(escanearPalabras(t, lem('año')).palabras[0].palabra, 'año');
});

const tableroAB = () => tableroDesde([{ q: 0, r: 0, letra: 'a' }, { q: 1, r: 0, letra: 'b' }]);
const lemAB = () => lem('aba', 'bab', 'abab', 'baba', 'ababa', 'babab');

test('límite de palabras: conserva las mejores y marca truncado', () => {
  const r = escanearPalabras(tableroAB(), lemAB(), { maxPalabras: 3 });
  assert.deepStrictEqual(r.palabras.map((p) => p.palabra), ['ababa', 'babab', 'abab']);
  assert.equal(r.truncado, true);
});

test('límite de nodos: no lanza, aborta y marca truncado', () => {
  const r = escanearPalabras(tableroAB(), lemAB(), { maxNodos: 1 });
  assert.deepStrictEqual(r, { palabras: [], truncado: true });
});

test('opciones inválidas usan los valores por defecto', () => {
  const r = escanearPalabras(basico(), lem('ala'), { maxPalabras: 0, maxNodos: 'x' });
  assert.equal(r.palabras.length, 1);
  assert.equal(r.truncado, false);
});

test('casos vacíos no lanzan', () => {
  const vacio = { palabras: [], truncado: false };
  assert.deepStrictEqual(escanearPalabras(basico(), cargarLemario('')), vacio);
  assert.deepStrictEqual(escanearPalabras(tableroDesde([]), lem('ala')), vacio);
  assert.deepStrictEqual(escanearPalabras(tableroDesde([{ q: 0, r: 0, letra: 'a' }]), lem('ala')), vacio);
  const t = basico();
  for (const c of t.casillas.values()) c.congeladaHasta = t.turno + 1;
  assert.deepStrictEqual(escanearPalabras(t, lem('ala')), vacio);
});

test('es determinista', () => {
  const t = tableroAB();
  assert.deepStrictEqual(escanearPalabras(t, lemAB()), escanearPalabras(t, lemAB()));
});

test('no modifica el tablero', () => {
  const t = tableroAB();
  const letras = () => [...t.casillas.values()].map((c) => c.letra).join('');
  const antes = [letras(), t.casillas.size, t.turno];
  escanearPalabras(t, lemAB());
  assert.deepStrictEqual([letras(), t.casillas.size, t.turno], antes);
});

test('consistencia en un tablero sembrado de radio 2', () => {
  const lemario = lemarioSintetico(1500, crearRng(2));
  const tablero = sembrarTablero(lemario, normalizarConfig({ radioInicial: 2 }), crearRng(11));
  const { palabras } = escanearPalabras(tablero, lemario);
  assert.ok(palabras.length > 0);
  for (const { palabra, camino, puntos } of palabras) {
    assert.equal(caminoValido(tablero, camino).valido, true);
    assert.equal(palabraDeCamino(tablero, camino), palabra);
    assert.equal(puntos, camino.length ** 2);
  }
});

test('rendimiento en un tablero sembrado de radio 5', () => {
  const lemario = lemarioSintetico(5000, crearRng(5));
  const tablero = sembrarTablero(lemario, normalizarConfig({ radioInicial: 5 }), crearRng(6));
  const inicio = performance.now();
  const { palabras } = escanearPalabras(tablero, lemario);
  const ms = performance.now() - inicio;
  assert.ok(ms < 2000, `tardó ${ms} ms`);
  assert.ok(palabras.length <= 100);
  for (let i = 1; i < palabras.length; i++) assert.ok(palabras[i - 1].puntos >= palabras[i].puntos);
});
