import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puntosDeHexagono, calcularViewBox, extenderCamino } from '../src/ui.js';
import { tableroDesde } from '../src/tablero.js';

test('puntosDeHexagono devuelve 6 vértices a distancia "tamano" del centro', () => {
  const pares = puntosDeHexagono(0, 0, 10).split(' ');
  assert.equal(pares.length, 6);
  for (const par of pares) {
    const [x, y] = par.split(',').map(Number);
    assert.ok(Math.abs(Math.hypot(x, y) - 10) < 0.01);
  }
});

test('puntosDeHexagono respeta el centro dado', () => {
  for (const par of puntosDeHexagono(50, -20, 10).split(' ')) {
    const [x, y] = par.split(',').map(Number);
    assert.ok(Math.abs(Math.hypot(x - 50, y + 20) - 10) < 0.01);
  }
});

test('calcularViewBox abarca todas las casillas y huecos y crece con ellas', () => {
  const t = tableroDesde([{ q: 0, r: 0, letra: 'a' }]);
  const [x0, y0, w0, h0] = calcularViewBox(t, 10).split(' ').map(Number);
  assert.ok(x0 < -10 && y0 < -10 && w0 > 20 && h0 > 20);
  t.poner(3, 0, 'b');
  t.huecos.add('0,3');
  const [, , w1, h1] = calcularViewBox(t, 10).split(' ').map(Number);
  assert.ok(w1 > w0);
  assert.ok(h1 > h0);
});

test('extenderCamino: añade vecinas, ignora lejanas y gestiona repetir la última', () => {
  const a = { q: 0, r: 0 };
  const b = { q: 1, r: 0 };
  assert.deepEqual(extenderCamino([], a), [a]);
  assert.deepEqual(extenderCamino([a], b), [a, b]);
  assert.deepEqual(extenderCamino([a, b], a), [a, b, a]); // se puede volver a una casilla anterior
  const lejana = { q: 3, r: 0 };
  const base = [a];
  assert.equal(extenderCamino(base, lejana), base);
  assert.equal(extenderCamino([a, b], b, { arrastre: true }).length, 2); // arrastre: sin cambios
  assert.deepEqual(extenderCamino([a, b], b), [a]); // toque: deshace un paso
});
