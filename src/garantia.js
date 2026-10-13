// Garantía de palabra larga: repara el tablero con el mínimo de cambios de letra.
import { clave } from './hex.js';
import { LONGITUD_MINIMA, normalizarConfig } from './config.js';
import { hayPalabraPosible, garantizarPalabraPosible } from './tablero.js';
import { buscarColocaciones } from './colocacion.js';

const LIMITE_COLOCACIONES = 200;

export function asegurarPalabraLarga(tablero, lemario, config, rng, opciones = {}) {
  const cfg = normalizarConfig(config);
  const preferir = new Set(opciones.preferir ?? []);
  const n = Math.max(
    LONGITUD_MINIMA,
    Math.min(cfg.longitudGarantizada, lemario.longitudMaxima, tablero.casillas.size),
  );
  const excluir = opciones.excluir ?? new Set();
  if (hayPalabraPosible(tablero, lemario, { incluirCongeladas: true, longitudMinima: n, excluir })) {
    // Conserva la garantía mínima: una palabra posible en casillas libres (no congeladas).
    garantizarPalabraPosible(tablero, lemario, rng);
    return true;
  }

  const rejilla = new Map();
  for (const c of tablero.casillas.values()) {
    if (c.congeladaHasta > tablero.turno) continue;
    rejilla.set(clave(c.q, c.r), { q: c.q, r: c.r, letra: c.letra, fija: false });
  }
  const colocaciones = buscarColocaciones(rejilla, lemario, {
    min: n, max: Math.min(lemario.longitudMaxima, rejilla.size), limite: LIMITE_COLOCACIONES, rng,
  }).filter((col) => !excluir.has(col.palabra));
  if (colocaciones.length === 0) {
    garantizarPalabraPosible(tablero, lemario, rng);
    return false;
  }

  const usadas = (col) => col.camino.filter((p) => preferir.has(clave(p.q, p.r))).length;
  const mejor = (a, b) => a.cambios - b.cambios || usadas(b) - usadas(a);
  let empatadas = [colocaciones[0]];
  for (const col of colocaciones.slice(1)) {
    const d = mejor(col, empatadas[0]);
    if (d < 0) empatadas = [col];
    else if (d === 0) empatadas.push(col);
  }
  const elegida = empatadas[Math.floor(rng() * empatadas.length)];
  elegida.camino.forEach((p, i) => { tablero.casilla(p.q, p.r).letra = elegida.palabra[i]; });
  return true;
}
