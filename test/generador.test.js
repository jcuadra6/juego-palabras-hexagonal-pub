import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearGeneradorLocal, generadorLocal } from '../src/generador.js';
import { tableroDesde } from '../src/tablero.js';
import { cargarLemario } from '../src/lemario.js';
import { crearRng } from '../src/rng.js';

test('crearGeneradorLocal expone los tres métodos y generadorLocal tiene la misma forma', () => {
  const nombres = ['sembrarTablero', 'elegirLetras', 'asegurarPalabraLarga'];
  for (const g of [crearGeneradorLocal(), generadorLocal]) {
    for (const n of nombres) assert.equal(typeof g[n], 'function', n);
  }
});

test('la fachada pasa opciones.excluir a asegurarPalabraLarga', () => {
  const t = tableroDesde(Array.from({ length: 6 }, (_, q) => ({ q, r: 0, letra: 'x' })));
  const l = cargarLemario('cabeza\nsol\n');
  const ok = crearGeneradorLocal().asegurarPalabraLarga(
    t, l, { longitudGarantizada: 6 }, crearRng(1), { excluir: new Set(['cabeza']) });
  assert.equal(ok, false);
  assert.ok(![...t.casillas.values()].map((c) => c.letra).join('').includes('cabeza'));
});
