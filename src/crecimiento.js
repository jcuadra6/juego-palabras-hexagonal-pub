// Eliminar, renovar y hacer crecer casillas del tablero.
import { clave, vecinos } from './hex.js';
import { FRECUENCIAS_LETRAS, PROBABILIDAD_ESPECIAL } from './config.js';

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

export function renovarLetras(tablero, camino, lemario, rng) {
  const vistas = new Set();
  for (const p of camino) {
    const k = clave(p.q, p.r);
    if (vistas.has(k)) continue;
    vistas.add(k);
    const c = tablero.casilla(p.q, p.r);
    if (!c) continue;
    c.letra = letraDistinta(c.letra, lemario, rng);
    c.especial = marcaOpcional(rng);
  }
}

function nuevaCasilla(tablero, q, r, lemario, rng) {
  const c = tablero.poner(q, r, lemario.letraAleatoria(rng));
  c.especial = marcaOpcional(rng);
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

function crecerFuera(tablero, n, lemario, rng) {
  let hechas = 0;
  while (hechas < n) {
    const cands = candidatosFuera(tablero);
    if (cands.length === 0) break;
    const { q, r } = elegir(cands, rng);
    nuevaCasilla(tablero, q, r, lemario, rng);
    hechas++;
  }
  return hechas;
}

function rellenarHuecos(tablero, n, lemario, rng) {
  let hechas = 0;
  while (hechas < n && tablero.huecos.size > 0) {
    const claves = [...tablero.huecos].sort();
    const { q, r } = aCoords(elegir(claves, rng));
    nuevaCasilla(tablero, q, r, lemario, rng);
    hechas++;
  }
  return hechas;
}

export function crecer(tablero, cantidad, modo, lemario, rng) {
  if (tablero.casillas.size === 0 || cantidad <= 0) return { anadidas: 0, rellenadas: 0 };
  let rellenadas = 0;
  let anadidas = 0;
  if (modo === 'fuera') {
    anadidas = crecerFuera(tablero, cantidad, lemario, rng);
  } else {
    const enHuecos = modo === 'mixto' ? Math.ceil(cantidad / 2) : cantidad;
    rellenadas = rellenarHuecos(tablero, enHuecos, lemario, rng);
    anadidas = rellenadas + crecerFuera(tablero, cantidad - rellenadas, lemario, rng);
  }
  return { anadidas, rellenadas };
}
