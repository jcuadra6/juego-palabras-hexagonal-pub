// Escáner de palabras posibles: lista todas las palabras que se pueden formar en el tablero.
import { clave, vecinos } from './hex.js';
import { LONGITUD_MINIMA, normalizarAyuda } from './config.js';

// Orden: puntuación descendente y, a igualdad, alfabético por comparación de cadenas.
function comparar(a, b) {
  if (a.puntos !== b.puntos) return b.puntos - a.puntos;
  if (a.palabra < b.palabra) return -1;
  return a.palabra > b.palabra ? 1 : 0;
}

// opciones: { excluir?: Set<string>, maxPalabras?: number, maxNodos?: number }.
// Devuelve { palabras: [{ palabra, camino, puntos }], truncado }. No modifica tablero ni lemario.
export function escanearPalabras(tablero, lemario, opciones = {}) {
  const { maxPalabras, maxNodos } = normalizarAyuda(opciones);
  const excluir = opciones?.excluir ?? new Set();
  const maxLong = lemario.longitudMaxima;
  if (maxLong < LONGITUD_MINIMA) return { palabras: [], truncado: false };

  const utilizables = [...tablero.casillas.values()]
    .filter((c) => c.congeladaHasta <= tablero.turno)
    .sort((a, b) => a.q - b.q || a.r - b.r);
  const vecinosDe = new Map();
  for (const c of utilizables) {
    vecinosDe.set(
      clave(c.q, c.r),
      vecinos(c.q, c.r)
        .map((v) => tablero.casilla(v.q, v.r))
        .filter((v) => v && v.congeladaHasta <= tablero.turno),
    );
  }

  // palabra -> { palabra, camino, repite }
  const encontradas = new Map();
  const camino = [];
  const enCamino = new Map();
  let nodos = 0;
  let abortado = false;

  function dfs(c, prefijo) {
    if (abortado) return;
    const texto = prefijo + c.letra;
    if (!lemario.esPrefijo(texto)) return;
    if (++nodos > maxNodos) {
      abortado = true;
      return;
    }
    const k = clave(c.q, c.r);
    camino.push(c);
    enCamino.set(k, (enCamino.get(k) ?? 0) + 1);
    if (texto.length >= LONGITUD_MINIMA && lemario.existe(texto) && !excluir.has(texto)) {
      const previa = encontradas.get(texto);
      if (!previa || (previa.repite && enCamino.size === camino.length)) {
        encontradas.set(texto, {
          palabra: texto,
          camino: camino.map(({ q, r }) => ({ q, r })),
          repite: enCamino.size !== camino.length,
        });
      }
    }
    if (texto.length < maxLong) {
      for (const v of vecinosDe.get(k)) dfs(v, texto);
    }
    camino.pop();
    const n = enCamino.get(k) - 1;
    if (n === 0) enCamino.delete(k);
    else enCamino.set(k, n);
  }

  for (const c of utilizables) dfs(c, '');

  const palabras = [...encontradas.values()]
    .map(({ palabra, camino: cam }) => ({ palabra, camino: cam, puntos: cam.length * cam.length }))
    .sort(comparar);
  const truncado = abortado || palabras.length > maxPalabras;
  return { palabras: palabras.slice(0, maxPalabras), truncado };
}
