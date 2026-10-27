import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cargarLemario, normalizar } from '../src/lemario.js';
import {
  avisosLemario, cargarTema, crearMision, actualizarMision, misionCumplida, nombreTematica, temaDeTematica,
} from '../src/modos.js';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const lemario = cargarLemario(leer('../data/lemario-muestra.txt'));
const TEMAS = ['general', 'halloween', 'navidad'];
const TEMATICAS = ['halloween', 'navidad'];

const temaMin = (retos) => cargarTema({
  nombre: 't',
  paleta: { fondo: '#000', casilla: '#111', texto: '#fff', acento: '#f00' },
  eventos: [{ tipo: 'eliminar', alcance: { radio: 1 }, duracion: 0, modoCrecimiento: null }],
  palabrasObjetivo: ['sol', 'mar', 'luna'],
  retos,
});

const temas = Object.fromEntries(TEMAS.map((t) => [t, cargarTema(JSON.parse(leer(`../data/temas/${t}.json`)))]));

for (const nombre of TEMAS) {
  test(`el tema ${nombre} es válido y sus palabras objetivo salen de la temática`, () => {
    const tema = temas[nombre];
    assert.ok(tema.eventos.length >= 2);
    assert.ok(tema.retos.length >= 2);
    assert.equal(tema.palabrasObjetivo, null);
  });
}

for (const nombre of TEMATICAS) {
  test(`la temática incluida ${nombre} tiene palabras etiquetadas y su tema`, () => {
    const l = cargarLemario(leer(`../data/tematicas/${nombre}.txt`));
    assert.deepEqual(l.listaEtiquetas, [nombre]);
    const palabras = l.palabrasDeEtiqueta(nombre);
    assert.ok(palabras.length >= 20);
    assert.equal(palabras.length, l.tamano); // todas las palabras llevan la etiqueta
    assert.ok(palabras.some((p) => p.length >= 6));
    assert.ok(temas[nombre], `falta data/temas/${nombre}.json`);
  });
}

test('temaDeTematica: General usa el tema general y no limita las palabras', () => {
  const l = cargarLemario('sol\ncasa;halloween');
  const tema = temaDeTematica(temas, l, '');
  assert.equal(tema.nombre, 'General');
  assert.equal(tema.palabrasObjetivo, null);
  assert.deepEqual(tema.retos, temas.general.retos);
});

test('temaDeTematica: una etiqueta con tema propio usa sus colores y sus palabras etiquetadas', () => {
  const l = cargarLemario('sol\ncalabaza;halloween\nbruja;Halloween');
  const tema = temaDeTematica(temas, l, 'halloween');
  assert.equal(tema.nombre, 'Halloween');
  assert.deepEqual(tema.paleta, temas.halloween.paleta);
  assert.deepEqual(tema.palabrasObjetivo, ['calabaza', 'bruja']);
});

test('temaDeTematica: una etiqueta sin tema usa el general con el nombre de la etiqueta', () => {
  const l = cargarLemario('sol\nplaya;verano\nola;verano');
  const tema = temaDeTematica(temas, l, 'verano');
  assert.equal(tema.nombre, 'Verano');
  assert.deepEqual(tema.eventos, temas.general.eventos);
  assert.deepEqual(tema.palabrasObjetivo, ['playa', 'ola']);
  assert.equal(nombreTematica(temas, 'navidad'), 'Navidad');
});

test('reto tema: en General cuenta cualquier palabra distinta; con temática, solo las etiquetadas', () => {
  const l = cargarLemario('sol\nmar\ncalabaza;halloween');
  const progresoTema = (tema, palabras) => {
    const m = crearMision(tema);
    for (const palabra of palabras) actualizarMision(m, { palabra, casillasRegeneradas: 0 }, tema);
    return m.objetivos.find((o) => o.tipo === 'tema').progreso;
  };
  assert.equal(progresoTema(temaDeTematica(temas, l, ''), ['sol', 'sol', 'mar']), 2);
  assert.equal(progresoTema(temaDeTematica(temas, l, 'halloween'), ['sol', 'mar', 'calabaza']), 1);
});

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
  assert.throws(() => cargarTema(roto({ palabrasObjetivo: 'sol' })), /palabrasObjetivo/);
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

test('avisosLemario: avisa de palabras objetivo ausentes y de longitud inalcanzable', () => {
  const tema = temaMin([{ tipo: 'longitud', meta: 6 }, { tipo: 'tema', meta: 2 }]);
  const corto = cargarLemario('sol\nmar\ncasa');
  const avisos = avisosLemario(tema, corto);
  assert.equal(avisos.length, 2);
  assert.match(avisos[0], /luna/);
  assert.doesNotMatch(avisos[0], /sol/);
  assert.match(avisos[1], /6/);
  assert.deepEqual(avisosLemario(tema, cargarLemario('sol\nmar\nluna\nperros')), []);
  assert.deepEqual(avisosLemario(null, corto), []);
});
