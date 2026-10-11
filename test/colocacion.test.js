import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscarColocaciones } from '../src/colocacion.js';
import { cargarLemario } from '../src/lemario.js';
import { clave, anillo } from '../src/hex.js';
import { crearRng } from '../src/rng.js';

function rejilla(celdas) {
  const m = new Map();
  for (const [q, r, letra = null, fija = false] of celdas) {
    m.set(clave(q, r), { q, r, letra, fija });
  }
  return m;
}

const linea = () => rejilla([[0, 0], [1, 0], [2, 0]]);

function lineaConMedio(letra, fija) {
  return rejilla([[0, 0], [1, 0, letra, fija], [2, 0]]);
}

const sol = cargarLemario('sol');
const opc = (extra = {}) => ({ min: 3, max: 3, rng: crearRng(1), ...extra });

test('rejilla vacía de letras: sol aparece en ambos sentidos', () => {
  const res = buscarColocaciones(linea(), sol, opc());
  assert.equal(res.length, 2);
  for (const c of res) {
    assert.equal(c.palabra, 'sol');
    assert.equal(c.camino.length, 3);
    assert.equal(c.asignadas, 3);
    assert.equal(c.cruces, 0);
    assert.equal(c.cambios, 0);
  }
});

test('celda fija con letra coincidente cuenta como cruce', () => {
  const res = buscarColocaciones(lineaConMedio('o', true), sol, opc());
  assert.equal(res.length, 2);
  for (const c of res) {
    assert.equal(c.cruces, 1);
    assert.equal(c.asignadas, 2);
    assert.equal(c.cambios, 0);
  }
});

test('celda fija con letra distinta descarta el camino', () => {
  assert.deepEqual(buscarColocaciones(lineaConMedio('x', true), sol, opc()), []);
});

test('celda no fija con letra distinta cuenta como cambio', () => {
  const res = buscarColocaciones(lineaConMedio('x', false), sol, opc());
  assert.equal(res.length, 2);
  for (const c of res) {
    assert.equal(c.cambios, 1);
    assert.equal(c.cruces, 0);
    assert.equal(c.asignadas, 2);
  }
});

test('no repite casilla en un camino', () => {
  const r = rejilla([[0, 0], [1, 0]]);
  assert.deepEqual(buscarColocaciones(r, cargarLemario('aba'), opc()), []);
});

test('solo devuelve palabras con longitud entre min y max', () => {
  const r = rejilla([[0, 0], [1, 0], [2, 0], [3, 0]]);
  const res = buscarColocaciones(r, cargarLemario('sol\nsola'), opc());
  assert.ok(res.length > 0);
  assert.ok(res.every((c) => c.palabra === 'sol'));
});

test('respeta el límite', () => {
  const r = rejilla(anillo(0).concat(anillo(1), anillo(2), anillo(3)).map((p) => [p.q, p.r]));
  const palabras = [];
  for (const x of 'abcde') for (const y of 'abcde') for (const z of 'abcde') palabras.push(x + y + z);
  const lem = cargarLemario(palabras.slice(0, 40).join('\n'));
  assert.equal(lem.palabrasDeLongitud(3).length, 40);
  const res = buscarColocaciones(r, lem, opc({ limite: 5 }));
  assert.equal(res.length, 5);
});

test('maxNodos agotado: no lanza y devuelve lo encontrado', () => {
  assert.deepEqual(buscarColocaciones(linea(), sol, opc({ maxNodos: 1 })), []);
});

test('misma semilla, mismo resultado', () => {
  const r = rejilla(anillo(0).concat(anillo(1), anillo(2)).map((p) => [p.q, p.r]));
  const lem = cargarLemario('sol\nmar\nsal\nola\nrio');
  const a = buscarColocaciones(r, lem, { min: 3, max: 3, rng: crearRng(7) });
  const b = buscarColocaciones(r, lem, { min: 3, max: 3, rng: crearRng(7) });
  assert.deepEqual(a, b);
});

test('rejilla vacía devuelve []', () => {
  assert.deepEqual(buscarColocaciones(new Map(), sol, opc()), []);
});
