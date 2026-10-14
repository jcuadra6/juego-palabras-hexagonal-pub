import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AYUDA, GENERADOR, MAX_NODOS_BUSQUEDA, normalizarAyuda, normalizarConfig,
} from '../src/config.js';

const copiaInicial = JSON.parse(JSON.stringify(GENERADOR));

test('valores iniciales de GENERADOR', () => {
  assert.deepStrictEqual(copiaInicial, {
    radioInicial: 3,
    densidad: 'media',
    densidades: { suave: 0.35, media: 0.60, densa: 0.85 },
    longitudSembrada: { min: 5, max: 9 },
    prioridadEncaje: 0.7,
    mezclaPesos: 0.5,
    longitudGarantizada: 6,
    presupuestoIntentos: 2000,
  });
  assert.equal(MAX_NODOS_BUSQUEDA, 5000);
});

test('normalizarConfig() sin argumentos devuelve los valores por defecto', () => {
  assert.deepStrictEqual(normalizarConfig(), GENERADOR);
});

test('normalizarConfig recorta prioridadEncaje y mezclaPesos a [0, 1]', () => {
  assert.equal(normalizarConfig({ prioridadEncaje: 5 }).prioridadEncaje, 1);
  assert.equal(normalizarConfig({ mezclaPesos: -1 }).mezclaPesos, 0);
  assert.equal(normalizarConfig({ mezclaPesos: 'a' }).mezclaPesos, 0.5);
});

test('normalizarConfig sustituye una densidad desconocida por media', () => {
  assert.equal(normalizarConfig({ densidad: 'xyz' }).densidad, 'media');
});

test('normalizarConfig fuerza longitudes mínimas y max >= min', () => {
  assert.deepStrictEqual(
    normalizarConfig({ longitudSembrada: { min: 1, max: 2 } }).longitudSembrada,
    { min: 3, max: 3 });
  assert.deepStrictEqual(
    normalizarConfig({ longitudSembrada: { min: 9, max: 5 } }).longitudSembrada,
    { min: 9, max: 9 });
  assert.equal(normalizarConfig({ longitudGarantizada: 1 }).longitudGarantizada, 3);
});

test('normalizarConfig trunca radioInicial y fija presupuestoIntentos >= 1', () => {
  assert.equal(normalizarConfig({ radioInicial: -2 }).radioInicial, 0);
  assert.equal(normalizarConfig({ radioInicial: 2.7 }).radioInicial, 2);
  assert.equal(normalizarConfig({ presupuestoIntentos: 0 }).presupuestoIntentos, 1);
});

test('normalizarConfig tolera null y claves desconocidas', () => {
  assert.deepStrictEqual(normalizarConfig(null), GENERADOR);
  assert.deepStrictEqual(normalizarConfig({ densidades: 5 }), GENERADOR);
});

test('normalizarConfig no muta GENERADOR ni la entrada', () => {
  const entrada = { longitudSembrada: { min: 1, max: 2 } };
  const salida = normalizarConfig(entrada);
  salida.longitudSembrada.min = 99;
  salida.densidades.suave = 99;
  assert.deepStrictEqual(entrada, { longitudSembrada: { min: 1, max: 2 } });
  assert.deepStrictEqual(GENERADOR, copiaInicial);
});

test('valores iniciales de AYUDA', () => {
  assert.deepStrictEqual(AYUDA, { maxPalabras: 100, maxNodos: 200000 });
});

test('normalizarAyuda() sin argumentos devuelve los valores por defecto', () => {
  assert.deepStrictEqual(normalizarAyuda(), AYUDA);
});

test('normalizarAyuda trunca maxPalabras y sustituye valores menores que 1', () => {
  assert.equal(normalizarAyuda({ maxPalabras: 0 }).maxPalabras, 100);
  assert.equal(normalizarAyuda({ maxPalabras: 2.7 }).maxPalabras, 2);
  assert.equal(normalizarAyuda({ maxPalabras: -5 }).maxPalabras, 100);
});

test('normalizarAyuda sustituye maxNodos no numérico o no finito', () => {
  assert.equal(normalizarAyuda({ maxNodos: 'x' }).maxNodos, 200000);
  assert.equal(normalizarAyuda({ maxNodos: Infinity }).maxNodos, 200000);
  assert.equal(normalizarAyuda({ maxNodos: 50 }).maxNodos, 50);
});

test('normalizarAyuda tolera null y no numéricos, y no muta AYUDA', () => {
  assert.deepStrictEqual(normalizarAyuda(null), { maxPalabras: 100, maxNodos: 200000 });
  assert.deepStrictEqual(normalizarAyuda(5), { maxPalabras: 100, maxNodos: 200000 });
  assert.deepStrictEqual(AYUDA, { maxPalabras: 100, maxNodos: 200000 });
});
