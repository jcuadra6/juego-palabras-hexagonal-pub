import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearRng } from '../src/rng.js';

test('misma semilla, misma secuencia', () => {
  const a = crearRng(42);
  const b = crearRng(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('valores en [0,1)', () => {
  const r = crearRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1);
  }
});
