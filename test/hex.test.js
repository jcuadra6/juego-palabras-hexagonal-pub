import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clave, vecinos, distancia, anillo, aPixel } from '../src/hex.js';

test('clave formatea q,r', () => {
  assert.equal(clave(1, -2), '1,-2');
});

test('vecinos devuelve 6 casillas distintas a distancia 1', () => {
  const v = vecinos(0, 0);
  assert.equal(v.length, 6);
  assert.equal(new Set(v.map((c) => clave(c.q, c.r))).size, 6);
  for (const c of v) assert.equal(distancia({ q: 0, r: 0 }, c), 1);
});

test('distancia hexagonal', () => {
  assert.equal(distancia({ q: 0, r: 0 }, { q: 2, r: -1 }), 2);
  assert.equal(distancia({ q: 0, r: 0 }, { q: 2, r: 1 }), 3);
});

test('anillo tiene 6*radio casillas a distancia radio', () => {
  for (const [radio, n] of [[1, 6], [2, 12]]) {
    const a = anillo(radio);
    assert.equal(a.length, n);
    assert.equal(new Set(a.map((c) => clave(c.q, c.r))).size, n);
    for (const c of a) assert.equal(distancia({ q: 0, r: 0 }, c), radio);
  }
});

test('anillo respeta el centro', () => {
  const centro = { q: 3, r: -1 };
  for (const c of anillo(2, centro)) assert.equal(distancia(centro, c), 2);
});

test('aPixel', () => {
  assert.deepEqual(aPixel(0, 0, 10), { x: 0, y: 0 });
  assert.ok(Math.abs(aPixel(1, 0, 10).x - 10 * Math.sqrt(3)) < 1e-9);
  assert.ok(Math.abs(aPixel(0, 2, 10).y - 30) < 1e-9);
});
