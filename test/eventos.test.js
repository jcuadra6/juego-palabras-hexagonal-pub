import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tableroDesde, caminoValido } from '../src/tablero.js';
import {
  EVENTOS_BASE, casillasEnAlcance, aplicarEvento, eventoDeMarca, modoActivo,
} from '../src/eventos.js';

function tablero7() {
  return tableroDesde([
    { q: 0, r: 0, letra: 'a' }, { q: 1, r: 0, letra: 'b' }, { q: 1, r: -1, letra: 'c' },
    { q: 0, r: -1, letra: 'd' }, { q: -1, r: 0, letra: 'e' }, { q: -1, r: 1, letra: 'f' },
    { q: 0, r: 1, letra: 'g' },
  ]);
}
const ev = (tipo, alcance, duracion = 0, modoCrecimiento = null) =>
  ({ tipo, alcance, duracion, modoCrecimiento });

test('EVENTOS_BASE cubre tipos y modos', () => {
  const tipos = new Set(EVENTOS_BASE.map((e) => e.tipo));
  for (const t of ['eliminar', 'congelar', 'ocultar']) assert.ok(tipos.has(t));
  assert.ok(EVENTOS_BASE.some((e) => e.modoCrecimiento === 'fuera'));
  assert.ok(EVENTOS_BASE.some((e) => e.modoCrecimiento === 'rellenar'));
  for (const e of EVENTOS_BASE) assert.equal(e.alcance.centro, undefined);
});

test('casillasEnAlcance por radio y por claves', () => {
  const t = tablero7();
  assert.equal(casillasEnAlcance(t, { centro: { q: 0, r: 0 }, radio: 1 }).length, 7);
  assert.deepEqual(casillasEnAlcance(t, { claves: ['0,0', '9,9'] }), ['0,0']);
  assert.deepEqual(casillasEnAlcance(t, { radio: 1 }), []);
});

test('eliminar radio 1 vacía el tablero sin lanzar', () => {
  const t = tablero7();
  aplicarEvento(t, ev('eliminar', { centro: { q: 0, r: 0 }, radio: 1 }));
  assert.equal(t.casillas.size, 0);
  assert.equal(t.huecos.size, 7);
});

test('congelar bloquea caminos hasta que pasa el turno', () => {
  const t = tablero7();
  aplicarEvento(t, ev('congelar', { claves: ['1,0'] }, 2));
  const camino = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 1, r: -1 }];
  assert.deepEqual(caminoValido(t, camino), { valido: false, motivo: 'congelada' });
  t.turno = 2;
  assert.deepEqual(caminoValido(t, camino), { valido: true });
});

test('ocultar fija ocultaHasta', () => {
  const t = tablero7();
  t.turno = 3;
  aplicarEvento(t, ev('ocultar', { centro: { q: 0, r: 0 }, radio: 0 }, 4));
  assert.equal(t.casilla(0, 0).ocultaHasta, 7);
  assert.equal(t.casilla(1, 0).ocultaHasta, 0);
});

test('eventoDeMarca', () => {
  const t = tablero7();
  const c = t.casilla(1, 0);
  c.especial = { tipo: 'eliminar' };
  assert.deepEqual(eventoDeMarca(c), ev('eliminar', { centro: { q: 1, r: 0 }, radio: 1 }));
  c.especial = { tipo: 'modo', modo: 'fuera' };
  assert.equal(eventoDeMarca(c), null);
  c.especial = null;
  assert.equal(eventoDeMarca(c), null);
});

test('modoActivo', () => {
  assert.equal(modoActivo([], 5), 'rellenar');
  const fuera = { evento: ev('ocultar', { radio: 1 }, 3, 'fuera'), hastaTurno: 8 };
  assert.equal(modoActivo([fuera], 5), 'fuera');
  assert.equal(modoActivo([fuera], 8), 'rellenar');
  const mixto = { evento: ev('ocultar', { radio: 1 }, 3, 'mixto'), hastaTurno: 9 };
  assert.equal(modoActivo([fuera, mixto], 5), 'mixto');
  const sin = { evento: ev('congelar', { radio: 1 }, 3, null), hastaTurno: 9 };
  assert.equal(modoActivo([fuera, sin], 5), 'fuera');
});
