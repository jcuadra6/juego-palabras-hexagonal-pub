// Siembra del tablero inicial: palabras reales cruzadas, resto de letras y garantía.
import { clave, anillo } from './hex.js';
import { LONGITUD_MINIMA, normalizarConfig } from './config.js';
import { buscarColocaciones } from './colocacion.js';
import { elegirLetras } from './letras.js';
import { asegurarPalabraLarga } from './garantia.js';
import { Tablero } from './tablero.js';

const LIMITE_COLOCACIONES = 50;

function posicionesDisco(radio) {
  const celdas = [{ q: 0, r: 0 }];
  for (let k = 1; k <= radio; k++) celdas.push(...anillo(k));
  return celdas;
}

// Longitud entre min y max con probabilidad proporcional a la longitud.
function sortearLongitud(min, max, rng) {
  let total = 0;
  for (let n = min; n <= max; n++) total += n;
  let x = rng() * total;
  for (let n = min; n <= max; n++) {
    x -= n;
    if (x < 0) return n;
  }
  return max;
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

// Cada iteración del bucle es un intento: una llamada a buscarColocaciones.
export function sembrarPalabras(lemario, config, rng) {
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

  let cubiertas = 0;
  for (let intento = 0; intento < cfg.presupuestoIntentos && cubiertas < objetivo; intento++) {
    const longitud = sortearLongitud(minLong, maxLong, rng);
    const validas = buscarColocaciones(rejilla, lemario, {
      min: longitud, max: longitud, limite: LIMITE_COLOCACIONES, rng,
    }).filter((c) => c.asignadas >= 1 && c.cambios === 0);
    const elegida = elegirColocacion(validas, cfg.densidad, palabras.length, rng);
    if (!elegida) continue;
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

export function sembrarTablero(lemario, config, rng) {
  const cfg = normalizarConfig(config);
  const { rejilla } = sembrarPalabras(lemario, cfg, rng);
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
