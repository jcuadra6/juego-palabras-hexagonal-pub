// Valores numéricos y constantes del juego.
export const LONGITUD_MINIMA = 3;
export const LETRAS_POR_CASILLA_NUEVA = 2;
export const EVENTO_CADA_PALABRAS = 3;
export const PROBABILIDAD_ESPECIAL = 0.1;
export const MODO_POR_DEFECTO = 'rellenar';

// Frecuencias relativas aproximadas (%) de las letras en español.
export const FRECUENCIAS_LETRAS = {
  a: 12.53, b: 1.42, c: 4.68, d: 5.86, e: 13.68, f: 0.69, g: 1.01,
  h: 0.70, i: 6.25, j: 0.44, k: 0.02, l: 4.97, m: 3.15, n: 6.71,
  ñ: 0.31, o: 8.68, p: 2.51, q: 0.88, r: 6.87, s: 7.98, t: 4.63,
  u: 3.93, v: 0.90, w: 0.01, x: 0.22, y: 0.90, z: 0.52,
};

// Parámetros del generador de tableros y letras.
export const GENERADOR = {
  radioInicial: 3,
  densidad: 'media',
  densidades: { suave: 0.35, media: 0.60, densa: 0.85 },
  longitudSembrada: { min: 5, max: 9 },
  prioridadEncaje: 0.7,
  mezclaPesos: 0.5,
  longitudGarantizada: 6,
  presupuestoIntentos: 2000,
};

// Tope de nodos expandidos en cada llamada a buscarColocaciones.
export const MAX_NODOS_BUSQUEDA = 5000;

const esNumero = (v) => typeof v === 'number' && Number.isFinite(v);
const recortar01 = (v, porDefecto) => (esNumero(v) ? Math.min(1, Math.max(0, v)) : porDefecto);
const entero = (v, porDefecto, minimo) =>
  Math.max(minimo, Math.trunc(esNumero(v) ? v : porDefecto));

// Devuelve una configuración nueva, completa y con valores válidos.
export function normalizarConfig(config) {
  const c = config && typeof config === 'object' ? config : {};
  const d = GENERADOR;
  const densidades = { ...d.densidades };
  if (c.densidades && typeof c.densidades === 'object') {
    for (const k of Object.keys(densidades)) {
      densidades[k] = recortar01(c.densidades[k], densidades[k]);
    }
  }
  const ls = c.longitudSembrada && typeof c.longitudSembrada === 'object' ? c.longitudSembrada : {};
  const min = entero(ls.min, d.longitudSembrada.min, LONGITUD_MINIMA);
  const max = Math.max(min, entero(ls.max, d.longitudSembrada.max, LONGITUD_MINIMA));
  return {
    radioInicial: entero(c.radioInicial, d.radioInicial, 0),
    densidad: Object.hasOwn(densidades, c.densidad) ? c.densidad : d.densidad,
    densidades,
    longitudSembrada: { min, max },
    prioridadEncaje: recortar01(c.prioridadEncaje, d.prioridadEncaje),
    mezclaPesos: recortar01(c.mezclaPesos, d.mezclaPesos),
    longitudGarantizada: entero(c.longitudGarantizada, d.longitudGarantizada, LONGITUD_MINIMA),
    presupuestoIntentos: entero(c.presupuestoIntentos, d.presupuestoIntentos, 1),
  };
}

// Parámetros del escáner de palabras posibles (panel de ayuda).
export const AYUDA = {
  maxPalabras: 100,
  maxNodos: 200000,
};

const enteroOPorDefecto = (v, porDefecto) => {
  const n = esNumero(v) ? Math.trunc(v) : porDefecto;
  return n >= 1 ? n : porDefecto;
};

// Devuelve una configuración de ayuda nueva, completa y con valores válidos.
export function normalizarAyuda(config) {
  const c = config && typeof config === 'object' ? config : {};
  return {
    maxPalabras: enteroOPorDefecto(c.maxPalabras, AYUDA.maxPalabras),
    maxNodos: enteroOPorDefecto(c.maxNodos, AYUDA.maxNodos),
  };
}
