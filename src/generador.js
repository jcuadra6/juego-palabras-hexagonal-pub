// Fachada del generador local: una interfaz única sobre siembra, letras y garantía.
import { normalizarConfig } from './config.js';
import { sembrarTablero } from './siembra.js';
import { elegirLetras } from './letras.js';
import { asegurarPalabraLarga, asegurarPalabraTematica } from './garantia.js';

export function crearGeneradorLocal() {
  return {
    sembrarTablero: (lemario, config, rng, opciones) =>
      sembrarTablero(lemario, normalizarConfig(config), rng, opciones),
    elegirLetras: (tablero, posiciones, lemario, config, rng) =>
      elegirLetras(tablero, posiciones, lemario, normalizarConfig(config), rng),
    asegurarPalabraLarga: (tablero, lemario, config, rng, opciones) =>
      asegurarPalabraLarga(tablero, lemario, normalizarConfig(config), rng, opciones),
    asegurarPalabraTematica,
  };
}

export const generadorLocal = crearGeneradorLocal();
