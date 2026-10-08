import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarLemario } from '../src/lemario.js';
import { tableroDesde } from '../src/tablero.js';
import { crearRng } from '../src/rng.js';
import { clave } from '../src/hex.js';
import { crearIaSimulada } from '../src/ia.js';

const lemario = cargarLemario('casa\narbol\nperro');
const tablero = () => tableroDesde([
  { q: 0, r: 0, letra: 'a' }, { q: 1, r: 0, letra: 'b' }, { q: 1, r: -1, letra: 'c' },
]);

test('validarPalabra consulta el lemario', async () => {
  const ia = crearIaSimulada({ lemario, rng: crearRng(1) });
  assert.deepEqual(await ia.validarPalabra('casa', {}), { valida: true });
  assert.deepEqual(await ia.validarPalabra('zzz', {}), { valida: false, motivo: 'no-esta-en-el-lemario' });
  assert.equal((await ia.validarPalabra('ÁRBOL', {})).valida, true);
});

test('siguienteEvento sin tema usa EVENTOS_BASE con centro en el tablero', async () => {
  const ia = crearIaSimulada({ lemario, rng: crearRng(2) });
  const t = tablero();
  for (let i = 0; i < 20; i++) {
    const ev = await ia.siguienteEvento({ tablero: t }, 'supervivencia', null);
    assert.ok(['eliminar', 'congelar', 'ocultar'].includes(ev.tipo));
    assert.equal(typeof ev.duracion, 'number');
    assert.ok(ev.alcance.centro);
    assert.ok(t.casillas.has(clave(ev.alcance.centro.q, ev.alcance.centro.r)));
    assert.equal(typeof ev.alcance.radio, 'number');
  }
});

test('con tema de un evento devuelve una copia', async () => {
  const ia = crearIaSimulada({ lemario, rng: crearRng(3) });
  const plantilla = { tipo: 'ocultar', alcance: { radio: 2 }, duracion: 5, modoCrecimiento: 'fuera' };
  const ev = await ia.siguienteEvento({ tablero: tablero() }, 'x', { eventos: [plantilla] });
  assert.notEqual(ev, plantilla);
  assert.equal(ev.tipo, 'ocultar');
  assert.equal(ev.alcance.radio, 2);
  ev.alcance.radio = 9;
  assert.equal(plantilla.alcance.radio, 2);
  assert.equal(plantilla.alcance.centro, undefined);
});

test('tablero vacío usa centro 0,0', async () => {
  const ia = crearIaSimulada({ lemario, rng: crearRng(4) });
  const ev = await ia.siguienteEvento({ tablero: tableroDesde([]) }, 'x', null);
  assert.deepEqual(ev.alcance.centro, { q: 0, r: 0 });
});
