import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sembrarPalabras, sembrarTablero } from '../src/siembra.js';
import { Tablero, caminoValido, palabraDeCamino, hayPalabraPosible } from '../src/tablero.js';
import { cargarLemario } from '../src/lemario.js';
import { crearRng } from '../src/rng.js';
import { clave } from '../src/hex.js';
import { GENERADOR } from '../src/config.js';
import { lemarioSintetico } from './helpers.js';

const LETRA = /^[a-zñ]$/;
const numCasillas = (radio) => 3 * radio * (radio + 1) + 1;

function tableroDeRejilla(rejilla) {
  const t = new Tablero();
  for (const c of rejilla.values()) t.poner(c.q, c.r, c.letra ?? 'a');
  return t;
}
const sembradas = (rejilla) => [...rejilla.values()].filter((c) => c.letra !== null).length;
const cobertura = (rejilla) => sembradas(rejilla) / rejilla.size;
const completo = (t, n) => {
  assert.equal(t.casillas.size, n);
  for (const c of t.casillas.values()) assert.match(c.letra, LETRA);
};
const letrasDe = (t) => [...t.casillas.values()].map((c) => `${c.q},${c.r}:${c.letra}`).join(' ');

test('radioInicial 2: 19 casillas, todas con una letra', () => {
  const lem = lemarioSintetico(1000, crearRng(1));
  completo(sembrarTablero(lem, { radioInicial: 2 }, crearRng(2)), 19);
});

test('cada palabra sembrada es un camino válido y coincide con el tablero', () => {
  const lem = lemarioSintetico(3000, crearRng(3));
  const { rejilla, palabras } = sembrarPalabras(lem, { radioInicial: 3 }, crearRng(4));
  assert.ok(palabras.length > 0);
  const t = tableroDeRejilla(rejilla);
  for (const { palabra, camino } of palabras) {
    assert.equal(caminoValido(t, camino).valido, true);
    assert.equal(new Set(camino.map((p) => clave(p.q, p.r))).size, camino.length);
    assert.equal(palabraDeCamino(t, camino), palabra);
  }
});

test('con el lemario de muestra hay palabra de 4 letras', () => {
  const lem = cargarLemario(readFileSync(new URL('../data/lemario-muestra.txt', import.meta.url), 'utf8'));
  const t = sembrarTablero(lem, { longitudSembrada: { min: 4, max: 6 } }, crearRng(5));
  assert.equal(hayPalabraPosible(t, lem, { longitudMinima: 4 }), true);
});

test('cobertura cercana al objetivo y ordenada por densidad', () => {
  const lem = lemarioSintetico(3000, crearRng(3));
  const cob = {};
  for (const densidad of ['suave', 'media', 'densa']) {
    const { rejilla } = sembrarPalabras(lem, { radioInicial: 3, densidad }, crearRng(7));
    cob[densidad] = cobertura(rejilla);
    assert.ok(cob[densidad] >= GENERADOR.densidades[densidad] - 0.15,
      `${densidad}: ${cob[densidad]}`);
  }
  assert.ok(cob.suave <= cob.media && cob.media <= cob.densa, JSON.stringify(cob));
});

test('media: cada palabra posterior cruza con alguna anterior; suave: algún cruce', () => {
  const lem = lemarioSintetico(3000, crearRng(3));
  const media = sembrarPalabras(lem, { radioInicial: 3, densidad: 'media' }, crearRng(8)).palabras;
  assert.ok(media.length >= 2);
  const vistas = new Set(media[0].camino.map((p) => clave(p.q, p.r)));
  for (const { camino } of media.slice(1)) {
    assert.ok(camino.some((p) => vistas.has(clave(p.q, p.r))));
    camino.forEach((p) => vistas.add(clave(p.q, p.r)));
  }
  const suave = sembrarPalabras(lem, { radioInicial: 3, densidad: 'suave' }, crearRng(8)).palabras;
  const ocupadas = new Set();
  let cruza = false;
  for (const { camino } of suave) {
    for (const p of camino) {
      if (ocupadas.has(clave(p.q, p.r))) cruza = true;
    }
    camino.forEach((p) => ocupadas.add(clave(p.q, p.r)));
  }
  assert.equal(cruza, true);
});

test('determinismo con la misma semilla', () => {
  const lem = lemarioSintetico(2000, crearRng(3));
  const a = sembrarTablero(lem, {}, crearRng(9));
  const b = sembrarTablero(lem, {}, crearRng(9));
  assert.equal(letrasDe(a), letrasDe(b));
});

test('lemario vacío o sin palabras largas: tablero completo sin lanzar', () => {
  completo(sembrarTablero(cargarLemario(''), {}, crearRng(1)), 37);
  const cortas = cargarLemario('sol\nmar\nsal\ncal');
  completo(sembrarTablero(cortas, { longitudSembrada: { min: 5, max: 5 } }, crearRng(1)), 37);
});

test('radio 0 y radio 1 con longitud 9', () => {
  const lem = lemarioSintetico(500, crearRng(1));
  completo(sembrarTablero(lem, { radioInicial: 0 }, crearRng(1)), 1);
  completo(sembrarTablero(lem, { radioInicial: 1, longitudSembrada: { min: 9, max: 9 } }, crearRng(1)), 7);
});

test('presupuestoIntentos 1: tablero completo', () => {
  const lem = lemarioSintetico(1000, crearRng(1));
  completo(sembrarTablero(lem, { presupuestoIntentos: 1 }, crearRng(1)), 37);
});

test('radioInicial 5 con lemario grande termina', () => {
  const lem = lemarioSintetico(5000, crearRng(5));
  completo(sembrarTablero(lem, { radioInicial: 5 }, crearRng(5)), numCasillas(5));
});

test('lemario con huecos de longitud: termina rápido con un tablero completo', () => {
  const l = cargarLemario('sol\nsal\nmal\nabcdefghijkl\n');
  const inicio = Date.now();
  const t = sembrarTablero(
    l, { ...GENERADOR, radioInicial: 3, longitudSembrada: { min: 5, max: 9 } }, crearRng(1));
  assert.ok(Date.now() - inicio < 500);
  completo(t, numCasillas(3));
});
