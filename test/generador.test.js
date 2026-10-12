import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearGeneradorLocal, generadorLocal } from '../src/generador.js';

test('crearGeneradorLocal expone los tres métodos y generadorLocal tiene la misma forma', () => {
  const nombres = ['sembrarTablero', 'elegirLetras', 'asegurarPalabraLarga'];
  for (const g of [crearGeneradorLocal(), generadorLocal]) {
    for (const n of nombres) assert.equal(typeof g[n], 'function', n);
  }
});
