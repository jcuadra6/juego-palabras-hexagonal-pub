import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elegirLetras } from '../src/letras.js';
import { cargarLemario } from '../src/lemario.js';
import { tableroDesde } from '../src/tablero.js';
import { FRECUENCIAS_LETRAS } from '../src/config.js';
import { vecinos } from '../src/hex.js';
import { crearRng } from '../src/rng.js';

const vacio = () => tableroDesde([{ q: 0, r: 0, letra: 'a' }]);

test('sin posiciones devuelve un Map vacío', () => {
  const res = elegirLetras(vacio(), [], cargarLemario('sol'), {}, crearRng(1));
  assert.ok(res instanceof Map);
  assert.equal(res.size, 0);
});

test('las posiciones duplicadas cuentan una vez', () => {
  const res = elegirLetras(vacio(), [{ q: 0, r: 0 }, { q: 0, r: 0 }], cargarLemario('sol'), {}, crearRng(1));
  assert.equal(res.size, 1);
});

test('solo frecuencia: letras del alfabeto y e más que z', () => {
  const lem = cargarLemario('sol');
  const rng = crearRng(1);
  const cuenta = {};
  for (let i = 0; i < 2000; i++) {
    const letra = elegirLetras(vacio(), [{ q: 5, r: 5 }], lem, { mezclaPesos: 0, prioridadEncaje: 0 }, rng).get('5,5');
    assert.ok(Object.hasOwn(FRECUENCIAS_LETRAS, letra));
    cuenta[letra] = (cuenta[letra] ?? 0) + 1;
  }
  assert.ok((cuenta.e ?? 0) > (cuenta.z ?? 0));
});

test('encaje: completa sol entre s y l', () => {
  const t = tableroDesde([{ q: 0, r: 0, letra: 's' }, { q: 2, r: 0, letra: 'l' }]);
  const res = elegirLetras(t, [{ q: 1, r: 0 }], cargarLemario('sol'), { prioridadEncaje: 1 }, crearRng(1));
  assert.deepEqual([...res], [['1,0', 'o']]);
});

test('encaje de varias posiciones colineales forma sol', () => {
  const t = tableroDesde([{ q: 9, r: 9, letra: 'a' }]);
  const pos = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];
  const res = elegirLetras(t, pos, cargarLemario('sol'), { prioridadEncaje: 1 }, crearRng(3));
  const palabra = pos.map((p) => res.get(`${p.q},${p.r}`)).join('');
  assert.ok(['sol', 'los'].includes(palabra));
});

test('mixto: tras q fijas sale u', () => {
  const t = tableroDesde(vecinos(0, 0).map((v) => ({ q: v.q, r: v.r, letra: 'q' })));
  const lem = cargarLemario('queso\nquien\nquema');
  let us = 0;
  for (let s = 1; s <= 200; s++) {
    const res = elegirLetras(t, [{ q: 0, r: 0 }], lem, { mezclaPesos: 1, prioridadEncaje: 0 }, crearRng(s));
    if (res.get('0,0') === 'u') us++;
  }
  assert.ok(us > 150, `u salió ${us} veces`);
});

test('acepta posiciones que aún no están en el tablero', () => {
  const res = elegirLetras(vacio(), [{ q: 1, r: 0 }], cargarLemario('sol'), {}, crearRng(2));
  assert.equal(res.size, 1);
  assert.ok(Object.hasOwn(FRECUENCIAS_LETRAS, res.get('1,0')));
});

test('presupuesto agotado: todas reciben letra del alfabeto', () => {
  const pos = [{ q: 3, r: 0 }, { q: 4, r: 0 }, { q: 5, r: 0 }, { q: 6, r: 0 }];
  const res = elegirLetras(vacio(), pos, cargarLemario('zzzzzz'),
    { prioridadEncaje: 1, presupuestoIntentos: 1 }, crearRng(4));
  assert.equal(res.size, 4);
  for (const p of pos) assert.ok(Object.hasOwn(FRECUENCIAS_LETRAS, res.get(`${p.q},${p.r}`)));
});

test('no modifica el tablero', () => {
  const t = tableroDesde([{ q: 0, r: 0, letra: 's' }, { q: 2, r: 0, letra: 'l' }]);
  const antes = JSON.stringify([...t.casillas]);
  elegirLetras(t, [{ q: 1, r: 0 }, { q: 0, r: 0 }], cargarLemario('sol'), { prioridadEncaje: 1 }, crearRng(1));
  assert.equal(JSON.stringify([...t.casillas]), antes);
});

test('lemario vacío: letras por frecuencia sin lanzar', () => {
  const pos = [{ q: 1, r: 0 }, { q: 2, r: 0 }];
  const res = elegirLetras(vacio(), pos, cargarLemario(''), {}, crearRng(5));
  assert.equal(res.size, 2);
  for (const l of res.values()) assert.ok(Object.hasOwn(FRECUENCIAS_LETRAS, l));
});
