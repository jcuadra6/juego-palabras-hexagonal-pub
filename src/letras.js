// Elección de letras: encaje de palabras del lemario y modelo mixto (frecuencia + pares).
import { clave, vecinos } from './hex.js';
import { buscarColocaciones } from './colocacion.js';
import { FRECUENCIAS_LETRAS, LONGITUD_MINIMA, normalizarConfig } from './config.js';

const ALFABETO = Object.keys(FRECUENCIAS_LETRAS);
const FRECUENCIA_MAXIMA = Math.max(...Object.values(FRECUENCIAS_LETRAS));

// Número de vecinas de la celda que ya tienen letra.
function vecinasConLetra(rejilla, celda) {
  return vecinos(celda.q, celda.r)
    .map((v) => rejilla.get(clave(v.q, v.r)))
    .filter((v) => v && v.letra !== null);
}

// Sorteo ponderado: usa rng() una sola vez.
function sortear(candidatas, pesos, rng) {
  const total = pesos.reduce((a, b) => a + b, 0);
  let x = rng() * total;
  for (let i = 0; i < candidatas.length; i++) {
    x -= pesos[i];
    if (x < 0) return candidatas[i];
  }
  return candidatas[candidatas.length - 1];
}

// Letra para una celda según el modelo mixto con sus vecinas ya fijadas.
function letraMixta(rejilla, celda, lemario, mezclaPesos, rng) {
  const vecinas = vecinasConLetra(rejilla, celda);
  const frecuencias = ALFABETO.map((l) => FRECUENCIAS_LETRAS[l] / FRECUENCIA_MAXIMA);
  const sumas = ALFABETO.map((l) =>
    vecinas.reduce((s, v) => s + lemario.frecuenciaPar(v.letra, l) + lemario.frecuenciaPar(l, v.letra), 0));
  const maximo = Math.max(...sumas);
  const pesos = ALFABETO.map((_, i) => {
    const combinaciones = maximo > 0 ? sumas[i] / maximo : frecuencias[i];
    return (1 - mezclaPesos) * frecuencias[i] + mezclaPesos * combinaciones;
  });
  return sortear(ALFABETO, pesos, rng);
}

// Mejor colocación que solo asigna letras libres: más asignadas y, a igualdad, más larga.
function mejorEncaje(rejilla, lemario, max, rng) {
  const validas = buscarColocaciones(rejilla, lemario, { min: LONGITUD_MINIMA, max, limite: 50, rng })
    .filter((c) => c.asignadas >= 1 && c.cambios === 0);
  let mejor = null;
  for (const c of validas) {
    if (!mejor || c.asignadas > mejor.asignadas
      || (c.asignadas === mejor.asignadas && c.palabra.length > mejor.palabra.length)) mejor = c;
  }
  return mejor;
}

// Devuelve Map clave -> letra para las posiciones dadas. No muta el tablero.
// Un intento del presupuesto es una llamada a buscarColocaciones.
export function elegirLetras(tablero, posiciones, lemario, config, rng) {
  const cfg = normalizarConfig(config);
  const rejilla = new Map();
  for (const c of tablero.casillas.values()) {
    rejilla.set(clave(c.q, c.r), { q: c.q, r: c.r, letra: c.letra, fija: true });
  }
  const pendientes = new Map();
  for (const p of posiciones) {
    const k = clave(p.q, p.r);
    if (pendientes.has(k)) continue;
    const celda = { q: p.q, r: p.r, letra: null, fija: false };
    rejilla.set(k, celda);
    pendientes.set(k, celda);
  }
  const resultado = new Map();
  const fijar = (celda, letra) => {
    celda.letra = letra;
    celda.fija = true;
    const k = clave(celda.q, celda.r);
    pendientes.delete(k);
    resultado.set(k, letra);
  };

  let presupuesto = cfg.presupuestoIntentos;
  while (pendientes.size > 0 && presupuesto > 0) {
    if (rng() < cfg.prioridadEncaje) {
      presupuesto--;
      const mejor = mejorEncaje(rejilla, lemario, cfg.longitudSembrada.max, rng);
      if (mejor) {
        mejor.camino.forEach((p, i) => {
          const celda = rejilla.get(clave(p.q, p.r));
          if (celda.letra === null) fijar(celda, mejor.palabra[i]);
        });
        continue;
      }
    }
    // Modelo mixto: la posición más rodeada de letras fijas (desempate por q y r).
    let elegida = null;
    let mejorN = -1;
    for (const celda of pendientes.values()) {
      const n = vecinasConLetra(rejilla, celda).length;
      if (n > mejorN || (n === mejorN && (celda.q < elegida.q || (celda.q === elegida.q && celda.r < elegida.r)))) {
        elegida = celda;
        mejorN = n;
      }
    }
    fijar(elegida, letraMixta(rejilla, elegida, lemario, cfg.mezclaPesos, rng));
  }
  // Presupuesto agotado: el resto por frecuencia.
  for (const celda of [...pendientes.values()]) fijar(celda, lemario.letraAleatoria(rng));
  return resultado;
}
