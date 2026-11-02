// Siembra del tablero inicial: palabras reales cruzadas, resto de letras y garantía.
import { clave, anillo } from './hex.js';
import { LONGITUD_MINIMA, normalizarConfig } from './config.js';
import { buscarColocaciones } from './colocacion.js';
import { elegirLetras } from './letras.js';
import { asegurarPalabraLarga, lemarioTematico } from './garantia.js';
import { Tablero } from './tablero.js';

const LIMITE_COLOCACIONES = 50;
const MAX_FALLOS_SEGUIDOS = 50;
// Palabras de la temática que se intentan sembrar primero (las de la trama general las cruzan).
export const PALABRAS_TEMATICAS_SEMBRADAS = 2;

function posicionesDisco(radio) {
  const celdas = [{ q: 0, r: 0 }];
  for (let k = 1; k <= radio; k++) celdas.push(...anillo(k));
  return celdas;
}

// Una longitud de la lista con probabilidad proporcional a la longitud.
function sortearLongitud(longitudes, rng) {
  const total = longitudes.reduce((suma, n) => suma + n, 0);
  let x = rng() * total;
  for (const n of longitudes) {
    x -= n;
    if (x < 0) return n;
  }
  return longitudes[longitudes.length - 1];
}

const elegirAlAzar = (lista, rng) => lista[Math.floor(rng() * lista.length)];

// Elige una colocación según la densidad, o null si ninguna cumple la regla.
function elegirColocacion(validas, densidad, nPalabras, rng) {
  if (validas.length === 0) return null;
  if (nPalabras === 0) return elegirAlAzar(validas, rng);
  const crucen = validas.filter((c) => c.cruces >= 1);
  if (densidad === 'suave') {
    if (nPalabras === 1) return crucen.length > 0 ? elegirAlAzar(crucen, rng) : null;
    return elegirAlAzar(validas, rng);
  }
  if (crucen.length === 0) return null;
  if (densidad === 'media') return elegirAlAzar(crucen, rng);
  const maximo = Math.max(...crucen.map((c) => c.cruces));
  return elegirAlAzar(crucen.filter((c) => c.cruces === maximo), rng);
}

// Siembra primero hasta PALABRAS_TEMATICAS_SEMBRADAS palabras distintas de la temática.
function sembrarTematicas(rejilla, tematicas, cfg, palabras, rng) {
  const usadas = new Set();
  for (let i = 0; i < PALABRAS_TEMATICAS_SEMBRADAS; i++) {
    const lemario = lemarioTematico(tematicas, usadas);
    const max = Math.min(lemario.longitudMaxima, rejilla.size);
    if (max < LONGITUD_MINIMA) return 0;
    const validas = buscarColocaciones(rejilla, lemario, {
      min: LONGITUD_MINIMA, max, limite: LIMITE_COLOCACIONES, rng,
    }).filter((c) => c.asignadas >= 1 && c.cambios === 0);
    if (validas.length === 0) break;
    const elegida = elegirAlAzar(validas, rng);
    elegida.camino.forEach((p, j) => {
      const celda = rejilla.get(clave(p.q, p.r));
      celda.letra = elegida.palabra[j];
      celda.fija = true;
    });
    usadas.add(elegida.palabra);
    palabras.push({ palabra: elegida.palabra, camino: elegida.camino, tematica: true });
  }
  return [...rejilla.values()].filter((c) => c.letra !== null).length;
}

// Cada iteración del bucle es un intento: una llamada a buscarColocaciones.
// opciones.tematicas: palabras de la temática elegida (normalizadas) que se siembran primero.
export function sembrarPalabras(lemario, config, rng, opciones = {}) {
  const cfg = normalizarConfig(config);
  const rejilla = new Map();
  for (const { q, r } of posicionesDisco(cfg.radioInicial)) {
    rejilla.set(clave(q, r), { q, r, letra: null, fija: false });
  }
  const palabras = [];
  const objetivo = cfg.densidades[cfg.densidad] * rejilla.size;
  const maxLong = Math.min(cfg.longitudSembrada.max, lemario.longitudMaxima, rejilla.size);
  if (maxLong < LONGITUD_MINIMA) return { rejilla, palabras };
  const minLong = Math.min(cfg.longitudSembrada.min, maxLong);
  // Solo longitudes con palabras en el lemario: las demás no pueden colocarse nunca.
  const longitudes = [];
  for (let n = minLong; n <= maxLong; n++) {
    if (lemario.palabrasDeLongitud(n).length > 0) longitudes.push(n);
  }
  if (longitudes.length === 0) return { rejilla, palabras };

  let cubiertas = opciones.tematicas?.length ? sembrarTematicas(rejilla, opciones.tematicas, cfg, palabras, rng) : 0;
  let fallosSeguidos = 0;
  for (let intento = 0; intento < cfg.presupuestoIntentos && cubiertas < objetivo; intento++) {
    if (fallosSeguidos >= MAX_FALLOS_SEGUIDOS) break;
    const longitud = sortearLongitud(longitudes, rng);
    const validas = buscarColocaciones(rejilla, lemario, {
      min: longitud, max: longitud, limite: LIMITE_COLOCACIONES, rng,
    }).filter((c) => c.asignadas >= 1 && c.cambios === 0);
    const elegida = elegirColocacion(validas, cfg.densidad, palabras.length, rng);
    if (!elegida) {
      fallosSeguidos++;
      continue;
    }
    fallosSeguidos = 0;
    elegida.camino.forEach((p, i) => {
      const celda = rejilla.get(clave(p.q, p.r));
      if (celda.letra === null) cubiertas++;
      celda.letra = elegida.palabra[i];
      celda.fija = true;
    });
    palabras.push({ palabra: elegida.palabra, camino: elegida.camino });
  }
  return { rejilla, palabras };
}

export function sembrarTablero(lemario, config, rng, opciones = {}) {
  const cfg = normalizarConfig(config);
  const { rejilla } = sembrarPalabras(lemario, cfg, rng, opciones);
  const tablero = new Tablero();
  const vacias = [];
  for (const celda of rejilla.values()) {
    if (celda.letra === null) {
      vacias.push({ q: celda.q, r: celda.r });
      tablero.poner(celda.q, celda.r, 'a');
    } else {
      tablero.poner(celda.q, celda.r, celda.letra);
    }
  }
  const letras = elegirLetras(tablero, vacias, lemario, cfg, rng);
  for (const [k, letra] of letras) tablero.casillas.get(k).letra = letra;
  asegurarPalabraLarga(tablero, lemario, cfg, rng, { preferir: vacias.map((p) => clave(p.q, p.r)) });
  return tablero;
}
