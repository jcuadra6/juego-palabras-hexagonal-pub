import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CLAVE_AJUSTES, conRuta, guardarAjustes, leerAjustes, leerRuta, normalizarAjustes,
} from '../src/ajustes.js';
import { AYUDA, GENERADOR } from '../src/config.js';

// Sustituto de localStorage en memoria.
function almacenFalso(inicial = {}) {
  const datos = { ...inicial };
  return {
    datos,
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => { datos[k] = String(v); },
  };
}

test('normalizarAjustes() da los valores por defecto', () => {
  assert.deepStrictEqual(normalizarAjustes(), {
    modo: 'supervivencia', tematica: '', mostrarLista: false, develop: false,
    generador: GENERADOR, ayuda: AYUDA,
  });
});

test('normalizarAjustes corrige tipos y rangos erróneos', () => {
  const a = normalizarAjustes({
    modo: 'otro', tematica: 5, mostrarLista: 'sí', develop: true,
    generador: { radioInicial: -3, densidad: 'xyz' }, ayuda: { maxPalabras: 0 },
  });
  assert.equal(a.modo, 'supervivencia');
  assert.equal(a.tematica, '');
  assert.equal(a.mostrarLista, false);
  assert.equal(a.develop, true);
  assert.equal(a.generador.radioInicial, 0);
  assert.equal(a.generador.densidad, 'media');
  assert.equal(a.ayuda.maxPalabras, AYUDA.maxPalabras);
});

test('leerRuta y conRuta trabajan con rutas anidadas sin mutar la entrada', () => {
  const a = normalizarAjustes();
  assert.equal(leerRuta(a, 'generador.longitudSembrada.min'), 5);
  const b = conRuta(a, 'generador.longitudSembrada.min', 7);
  assert.equal(b.generador.longitudSembrada.min, 7);
  assert.equal(a.generador.longitudSembrada.min, 5);
  assert.equal(conRuta(a, 'generador.prioridadEncaje', 3).generador.prioridadEncaje, 1);
  assert.equal(conRuta(a, 'ayuda.maxNodos', 5000).ayuda.maxNodos, 5000);
  assert.equal(leerRuta(a, 'no.existe'), undefined);
});

test('guardarAjustes y leerAjustes recuerdan los ajustes', () => {
  const almacen = almacenFalso();
  const a = conRuta(normalizarAjustes({ modo: 'misiones', tematica: 'halloween', mostrarLista: true }), 'generador.radioInicial', 2);
  assert.equal(guardarAjustes(almacen, a), true);
  assert.ok(CLAVE_AJUSTES in almacen.datos);
  assert.deepStrictEqual(leerAjustes(almacen), a);
});

test('leerAjustes tolera datos dañados, almacén ausente o que falla', () => {
  assert.deepStrictEqual(leerAjustes(almacenFalso({ [CLAVE_AJUSTES]: '{roto' })), normalizarAjustes());
  assert.deepStrictEqual(leerAjustes(null), normalizarAjustes());
  const roto = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('lleno'); } };
  assert.deepStrictEqual(leerAjustes(roto), normalizarAjustes());
  assert.equal(guardarAjustes(roto, normalizarAjustes()), false);
  assert.equal(guardarAjustes(null, normalizarAjustes()), false);
});

// La cruz de Ajustes no debe depender de la validación del formulario: si un valor por defecto
// no encajaba con el min/max/step de su campo, el navegador bloqueaba el cierre del diálogo.
test('la pantalla de ajustes se cierra aunque un campo no sea válido para el navegador', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<form method="dialog" class="ajustes" novalidate>/);
  assert.match(html, /<button type="button" id="cerrar-ajustes"/);
});

test('los valores por defecto encajan con el min, max y step de cada campo de ajustes', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const porDefecto = normalizarAjustes();
  const campos = [...html.matchAll(/<input type="number" ([^>]*)>/g)].map((m) => Object.fromEntries(
    [...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]),
  ));
  assert.ok(campos.length >= 9);
  for (const c of campos) {
    const v = leerRuta(porDefecto, c['data-ruta']);
    const min = Number(c.min ?? 0);
    assert.ok(v >= min, `${c['data-ruta']}: ${v} < ${min}`);
    if (c.max !== undefined) assert.ok(v <= Number(c.max), `${c['data-ruta']}: ${v} > ${c.max}`);
    const pasos = (v - min) / Number(c.step);
    assert.ok(Math.abs(pasos - Math.round(pasos)) < 1e-9, `${c['data-ruta']}: ${v} no encaja con step ${c.step}`);
  }
});
