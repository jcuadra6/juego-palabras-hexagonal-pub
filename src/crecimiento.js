// Eliminar, renovar y hacer crecer casillas del tablero.
import { clave, vecinos } from './hex.js';
import { FRECUENCIAS_LETRAS, PROBABILIDAD_ESPECIAL, GENERADOR } from './config.js';
import { generadorLocal } from './generador.js';

const MARCAS = [
  { tipo: 'modo', modo: 'rellenar' },
  { tipo: 'modo', modo: 'fuera' },
  { tipo: 'modo', modo: 'mixto' },
  { tipo: 'eliminar' },
];
const MAX_INTENTOS_LETRA = 50;

function aCoords(k) {
  const [q, r] = k.split(',').map(Number);
  return { q, r };
}

export function eliminarCasillas(tablero, claves) {
  let quitadas = 0;
  for (const k of claves) {
    if (tablero.casillas.delete(k)) {
      tablero.huecos.add(k);
      quitadas++;
    }
  }
  return quitadas;
}

export function marcaAleatoria(rng) {
  const m = MARCAS[Math.min(MARCAS.length - 1, Math.floor(rng() * MARCAS.length))];
  return { ...m };
}

function marcaOpcional(rng) {
  return rng() < PROBABILIDAD_ESPECIAL ? marcaAleatoria(rng) : null;
}

function letraDistinta(anterior, lemario, rng) {
  for (let i = 0; i < MAX_INTENTOS_LETRA; i++) {
    const l = lemario.letraAleatoria(rng);
    if (l !== anterior) return l;
  }
  return Object.keys(FRECUENCIAS_LETRAS).find((l) => l !== anterior);
}

export function renovarLetras(tablero, camino, lemario, rng, opciones = {}) {
  const { generador = generadorLocal, config = GENERADOR } = opciones;
  const vistas = new Set();
  const casillas = [];
  for (const p of camino) {
    const k = clave(p.q, p.r);
    if (vistas.has(k)) continue;
    vistas.add(k);
    const c = tablero.casilla(p.q, p.r);
    if (c) casillas.push(c);
  }
  if (casillas.length === 0) return;
  const nuevas = generador.elegirLetras(
    tablero, casillas.map((c) => ({ q: c.q, r: c.r })), lemario, config, rng);
  for (const c of casillas) {
    const letra = nuevas.get(clave(c.q, c.r));
    c.letra = letra !== undefined && letra !== c.letra ? letra : letraDistinta(c.letra, lemario, rng);
    c.especial = marcaOpcional(rng);
  }
}

// Pone la casilla con letra provisional; la letra real se pide después de una vez.
function nuevaCasilla(tablero, q, r) {
  tablero.poner(q, r, '');
  return { q, r };
}

function elegir(lista, rng) {
  return lista[Math.min(lista.length - 1, Math.floor(rng() * lista.length))];
}

function candidatosFuera(tablero) {
  const vistos = new Set();
  const res = [];
  for (const c of tablero.casillas.values()) {
    for (const v of vecinos(c.q, c.r)) {
      const k = clave(v.q, v.r);
      if (tablero.casillas.has(k) || tablero.huecos.has(k) || vistos.has(k)) continue;
      vistos.add(k);
      res.push(v);
    }
  }
  res.sort((a, b) => a.q - b.q || a.r - b.r);
  return res;
}

function crecerFuera(tablero, n, rng, nuevas) {
  let hechas = 0;
  while (hechas < n) {
    const cands = candidatosFuera(tablero);
    if (cands.length === 0) break;
    const { q, r } = elegir(cands, rng);
    nuevas.push(nuevaCasilla(tablero, q, r));
    hechas++;
  }
  return hechas;
}

function rellenarHuecos(tablero, n, rng, nuevas) {
  let hechas = 0;
  while (hechas < n && tablero.huecos.size > 0) {
    const claves = [...tablero.huecos].sort();
    const { q, r } = aCoords(elegir(claves, rng));
    nuevas.push(nuevaCasilla(tablero, q, r));
    hechas++;
  }
  return hechas;
}

export function crecer(tablero, cantidad, modo, lemario, rng, opciones = {}) {
  const { generador = generadorLocal, config = GENERADOR } = opciones;
  if (tablero.casillas.size === 0 || cantidad <= 0) return { anadidas: 0, rellenadas: 0 };
  const nuevas = [];
  let rellenadas = 0;
  let anadidas = 0;
  if (modo === 'fuera') {
    anadidas = crecerFuera(tablero, cantidad, rng, nuevas);
  } else {
    const enHuecos = modo === 'mixto' ? Math.ceil(cantidad / 2) : cantidad;
    rellenadas = rellenarHuecos(tablero, enHuecos, rng, nuevas);
    anadidas = rellenadas + crecerFuera(tablero, cantidad - rellenadas, rng, nuevas);
  }
  if (nuevas.length > 0) {
    const letras = generador.elegirLetras(tablero, nuevas, lemario, config, rng);
    for (const { q, r } of nuevas) {
      const c = tablero.casilla(q, r);
      c.letra = letras.get(clave(q, r)) ?? lemario.letraAleatoria(rng);
      c.especial = marcaOpcional(rng);
    }
  }
  return { anadidas, rellenadas };
}
