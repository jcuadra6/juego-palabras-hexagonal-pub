import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cargarLemario, normalizar } from '../src/lemario.js';
import { cargarTema, crearMision, actualizarMision, misionCumplida } from '../src/modos.js';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const lemario = cargarLemario(leer('../data/lemario-muestra.txt'));
const TEMAS = ['halloween', 'navidad'];

const temaMin = (retos) => cargarTema({
  nombre: 't',
  paleta: { fondo: '#000', casilla: '#111', texto: '#fff', acento: '#f00' },
  eventos: [{ tipo: 'eliminar', alcance: { radio: 1 }, duracion: 0, modoCrecimiento: null }],
  palabrasObjetivo: ['sol', 'mar', 'luna'],
  retos,
});

for (const nombre of TEMAS) {
  test(`el tema ${nombre} es válido y sus palabras existen en el lemario`, () => {
    const tema = cargarTema(JSON.parse(leer(`../data/temas/${nombre}.json`)));
    assert.ok(tema.eventos.length >= 2);
    assert.ok(tema.palabrasObjetivo.length >= 10);
    assert.ok(tema.retos.length >= 2);
    for (const p of tema.palabrasObjetivo) assert.ok(lemario.existe(p), `falta ${p}`);
    assert.ok(tema.palabrasObjetivo.some((p) => p.length >= 5));
  });
}

test('cargarTema sin eventos lanza un error que nombra el campo', () => {
  assert.throws(() => cargarTema({ nombre: 'x' }), (e) => e instanceof Error && /eventos/.test(e.message));
});

test('cargarTema valida la forma de cada campo', () => {
  const base = JSON.parse(leer('../data/temas/navidad.json'));
  const roto = (cambio) => ({ ...base, ...cambio });
  assert.throws(() => cargarTema(roto({ paleta: { fondo: '#000' } })), /paleta/);
  assert.throws(() => cargarTema(roto({ eventos: [{ tipo: 'volar', alcance: { radio: 1 }, duracion: 0, modoCrecimiento: null }] })), /tipo/);
  assert.throws(() => cargarTema(roto({ eventos: [{ tipo: 'eliminar', alcance: {}, duracion: 0, modoCrecimiento: null }] })), /radio/);
  assert.throws(() => cargarTema(roto({ eventos: [{ tipo: 'eliminar', alcance: { radio: 1 }, duracion: 0, modoCrecimiento: 'x' }] })), /modoCrecimiento/);
  assert.throws(() => cargarTema(roto({ palabrasObjetivo: [] })), /palabrasObjetivo/);
  assert.throws(() => cargarTema(roto({ retos: [{ tipo: 'otro', meta: 1 }] })), /retos/);
});

test('reto longitud: se cumple con perros y no con sol', () => {
  const tema = temaMin([{ tipo: 'longitud', meta: 5 }]);
  const m = crearMision(tema);
  actualizarMision(m, { palabra: 'sol', casillasRegeneradas: 0 }, tema);
  assert.equal(m.objetivos[0].cumplido, false);
  actualizarMision(m, { palabra: 'perros', casillasRegeneradas: 0 }, tema);
  assert.equal(m.objetivos[0].cumplido, true);
});

test('reto tema: cuenta palabras objetivo distintas', () => {
  const tema = temaMin([{ tipo: 'tema', meta: 2 }]);
  const m = crearMision(tema);
  actualizarMision(m, { palabra: 'Sol', casillasRegeneradas: 0 }, tema);
  actualizarMision(m, { palabra: 'sol', casillasRegeneradas: 0 }, tema);
  actualizarMision(m, { palabra: 'perro', casillasRegeneradas: 0 }, tema);
  assert.equal(m.objetivos[0].progreso, 1);
  assert.equal(m.objetivos[0].cumplido, false);
  actualizarMision(m, { palabra: 'mar', casillasRegeneradas: 0 }, tema);
  assert.equal(m.objetivos[0].cumplido, true);
});

test('reto regenerar acumula casillas regeneradas', () => {
  const tema = temaMin([{ tipo: 'regenerar', meta: 3 }]);
  const m = crearMision(tema);
  actualizarMision(m, { palabra: 'sol', casillasRegeneradas: 2 }, tema);
  assert.equal(m.objetivos[0].progreso, 2);
  assert.equal(m.objetivos[0].cumplido, false);
  actualizarMision(m, { palabra: 'sol', casillasRegeneradas: 1 }, tema);
  assert.equal(m.objetivos[0].cumplido, true);
});

test('misionCumplida solo si todos los objetivos están cumplidos', () => {
  const tema = temaMin([{ tipo: 'longitud', meta: 5 }, { tipo: 'regenerar', meta: 1 }]);
  const m = crearMision(tema);
  assert.equal(misionCumplida(m), false);
  actualizarMision(m, { palabra: 'perros', casillasRegeneradas: 0 }, tema);
  assert.equal(misionCumplida(m), false);
  actualizarMision(m, { palabra: 'sol', casillasRegeneradas: 1 }, tema);
  assert.equal(misionCumplida(m), true);
  assert.equal(normalizar('Ñu'), 'ñu');
});
