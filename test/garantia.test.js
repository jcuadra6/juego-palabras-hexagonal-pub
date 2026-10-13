import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asegurarPalabraLarga } from '../src/garantia.js';
import { tableroDesde, hayPalabraPosible } from '../src/tablero.js';
import { cargarLemario } from '../src/lemario.js';
import { crearRng } from '../src/rng.js';
import { clave } from '../src/hex.js';

const lem = (...p) => cargarLemario(p.join('\n'));
const linea = (letras, q0 = 0, r0 = 0) =>
  letras.map((letra, i) => ({ q: q0 + i, r: r0, letra }));
const letrasDe = (t) => [...t.casillas.values()].map((c) => c.letra).join('');
const cambiadas = (antes, t) =>
  [...t.casillas.values()].filter((c) => antes.get(clave(c.q, c.r)) !== c.letra);
const foto = (t) => new Map([...t.casillas.values()].map((c) => [clave(c.q, c.r), c.letra]));

test('ya existe palabra de N letras: true sin tocar nada', () => {
  const t = tableroDesde(linea([...'cabeza']));
  const antes = letrasDe(t);
  assert.equal(asegurarPalabraLarga(t, lem('cabeza'), { longitudGarantizada: 6 }, crearRng(1)), true);
  assert.equal(letrasDe(t), antes);
});

test('construye una palabra de N letras con a lo sumo N cambios', () => {
  const t = tableroDesde(linea([...'xxxxxx']));
  const antes = foto(t);
  const l = lem('cabeza');
  assert.equal(asegurarPalabraLarga(t, l, { longitudGarantizada: 6 }, crearRng(1)), true);
  assert.equal(hayPalabraPosible(t, l, { longitudMinima: 6, incluirCongeladas: true }), true);
  assert.ok(cambiadas(antes, t).length <= 6);
});

test('preferir: a igual coste solo cambia la región preferida', () => {
  const a = linea([...'xxx'], 0, 0);
  const b = linea([...'xxx'], 0, 6);
  for (const [pref, otra] of [[a, b], [b, a]]) {
    const t = tableroDesde([...a, ...b]);
    const antes = foto(t);
    asegurarPalabraLarga(t, lem('sol'), { longitudGarantizada: 3 }, crearRng(3),
      { preferir: pref.map((c) => clave(c.q, c.r)) });
    const cambios = cambiadas(antes, t);
    assert.equal(cambios.length, 3);
    const claves = new Set(pref.map((c) => clave(c.q, c.r)));
    assert.ok(cambios.every((c) => claves.has(clave(c.q, c.r))));
    assert.ok(otra.every((c) => t.casilla(c.q, c.r).letra === 'x'));
  }
});

test('todas congeladas: no modifica, no lanza, devuelve false', () => {
  const t = tableroDesde(linea([...'xxxxxx']));
  for (const c of t.casillas.values()) c.congeladaHasta = 5;
  assert.equal(asegurarPalabraLarga(t, lem('cabeza'), { longitudGarantizada: 6 }, crearRng(1)), false);
  assert.equal(letrasDe(t), 'xxxxxx');
});

test('lemario con palabras de 5 como máximo: N baja a 5', () => {
  const t = tableroDesde(linea([...'xxxxxx']));
  const l = lem('cabra');
  assert.equal(asegurarPalabraLarga(t, l, { longitudGarantizada: 6 }, crearRng(1)), true);
  assert.equal(hayPalabraPosible(t, l, { longitudMinima: 5 }), true);
});

test('lemario vacío: false sin lanzar ni modificar', () => {
  const t = tableroDesde(linea([...'xxxxxx']));
  assert.equal(asegurarPalabraLarga(t, lem(), { longitudGarantizada: 6 }, crearRng(1)), false);
  assert.equal(letrasDe(t), 'xxxxxx');
});

test('tablero de 4 casillas con longitudGarantizada 6: no lanza', () => {
  const t = tableroDesde(linea([...'xxxx']));
  assert.doesNotThrow(() =>
    asegurarPalabraLarga(t, lem('cabeza', 'sol'), { longitudGarantizada: 6 }, crearRng(1)));
});

test('palabra larga solo en casillas congeladas: sigue habiendo palabra mínima libre', () => {
  const t = tableroDesde([...linea([...'murcia'], 0, 0), ...linea([...'zzz'], 0, 4)]);
  for (let q = 0; q < 6; q++) t.casilla(q, 0).congeladaHasta = 5;
  const l = lem('murcia', 'sol');
  assert.equal(hayPalabraPosible(t, l), false);
  assert.equal(asegurarPalabraLarga(t, l, { longitudGarantizada: 6 }, crearRng(1)), true);
  assert.equal(hayPalabraPosible(t, l), true);
  assert.equal(letrasDe(t).slice(0, 6), 'murcia');
});

test('excluir: una palabra larga ya usada no cuenta y se repara con otra', () => {
  const t = tableroDesde(linea([...'cabezas']));
  const l = lem('cabeza', 'camisa');
  const excluir = new Set(['cabeza']);
  assert.equal(asegurarPalabraLarga(t, l, { longitudGarantizada: 6 }, crearRng(1), { excluir }), true);
  assert.equal(letrasDe(t).slice(0, 6) === 'camisa' || letrasDe(t).slice(1, 7) === 'camisa', true);
  assert.equal(hayPalabraPosible(t, l, { longitudMinima: 6, excluir }), true);
});

test('excluir: si todas las palabras largas están excluidas no repara con ninguna', () => {
  const t = tableroDesde(linea([...'xxxxxx']));
  const l = lem('cabeza', 'sol');
  assert.equal(asegurarPalabraLarga(t, l, { longitudGarantizada: 6 }, crearRng(1),
    { excluir: new Set(['cabeza']) }), false);
  assert.ok(!letrasDe(t).includes('cabeza'));
});

test('la reparación busca longitudes entre N y la máxima del lemario', () => {
  const t = tableroDesde(linea([...'xxxxxxxxxxxxxx']));
  const l = lem('sol', 'sal', 'mal', 'abcdefghijkl');
  assert.equal(asegurarPalabraLarga(t, l, { longitudGarantizada: 6 }, crearRng(1)), true);
  assert.equal(hayPalabraPosible(t, l, { longitudMinima: 6 }), true);
});
