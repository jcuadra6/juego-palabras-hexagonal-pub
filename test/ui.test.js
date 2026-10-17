import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  puntosDeHexagono, calcularViewBox, extenderCamino,
  numerarCamino, alternarSeleccion, reconciliarSeleccion, puntosDeCamino, siguientePista,
} from '../src/ui.js';
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

test('numerarCamino numera desde 1 y acumula los números de las casillas repetidas', () => {
  const m = numerarCamino([{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 0 }]);
  assert.equal(m.size, 2);
  assert.deepEqual(m.get('0,0'), [1, 3]);
  assert.deepEqual(m.get('1,0'), [2]);
});

test('numerarCamino de un camino vacío devuelve un mapa vacío', () => {
  assert.equal(numerarCamino([]).size, 0);
});

test('alternarSeleccion selecciona, deselecciona y reemplaza', () => {
  assert.equal(alternarSeleccion(null, 'sol'), 'sol');
  assert.equal(alternarSeleccion('sol', 'sol'), null);
  assert.equal(alternarSeleccion('sol', 'ola'), 'ola');
});

test('reconciliarSeleccion conserva la selección solo si sigue en la lista', () => {
  assert.equal(reconciliarSeleccion('sol', [{ palabra: 'sol' }, { palabra: 'ola' }]), 'sol');
  assert.equal(reconciliarSeleccion('sol', [{ palabra: 'ola' }]), null);
  assert.equal(reconciliarSeleccion(null, [{ palabra: 'sol' }]), null);
  assert.equal(reconciliarSeleccion('sol', []), null);
});

test('puntosDeCamino une los centros de las casillas con tres decimales', () => {
  assert.equal(puntosDeCamino([{ q: 0, r: 0 }, { q: 1, r: 0 }], 10), '0.000,0.000 17.321,0.000');
  assert.equal(puntosDeCamino([], 10), '');
});

test('siguientePista recorre la lista en orden y vuelve a empezar', () => {
  const lista = [{ palabra: 'casa' }, { palabra: 'sol' }, { palabra: 'ola' }];
  assert.equal(siguientePista([], null), null);
  assert.equal(siguientePista([], 'sol'), null);
  assert.equal(siguientePista(lista, null), lista[0]);
  assert.equal(siguientePista(lista, 'casa'), lista[1]);
  assert.equal(siguientePista(lista, 'ola'), lista[0]);
  assert.equal(siguientePista(lista, 'mesa'), lista[0]);
});
