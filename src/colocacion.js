// Motor de colocación: busca palabras del lemario como caminos de casillas vecinas.
import { clave, vecinos } from './hex.js';
import { MAX_NODOS_BUSQUEDA } from './config.js';

// Baraja una copia del array (Fisher-Yates) con el rng inyectado.
function barajar(lista, rng) {
  const copia = lista.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function buscarColocaciones(rejilla, lemario, opciones) {
  const { min, max, rng, limite = 20, maxNodos = MAX_NODOS_BUSQUEDA } = opciones;
  const resultado = [];
  const usadas = new Set();
  const camino = [];
  let nodos = 0;

  function agotado() {
    return nodos >= maxNodos || resultado.length >= limite;
  }

  // Intenta poner `letra` en la celda y continuar la búsqueda desde ella.
  function expandir(celda, letra, prefijo, cruces, asignadas, cambios) {
    if (celda.letra !== null && celda.fija && celda.letra !== letra) return;
    nodos++;
    if (celda.letra === null) asignadas++;
    else if (celda.letra === letra) cruces++;
    else cambios++;

    const palabra = prefijo + letra;
    usadas.add(clave(celda.q, celda.r));
    camino.push({ q: celda.q, r: celda.r });

    if (palabra.length >= min && lemario.existe(palabra)) {
      resultado.push({ palabra, camino: camino.slice(), cruces, asignadas, cambios });
    }
    if (palabra.length < max) {
      continuar(celda, palabra, cruces, asignadas, cambios);
    }

    camino.pop();
    usadas.delete(clave(celda.q, celda.r));
  }

  function continuar(celda, prefijo, cruces, asignadas, cambios) {
    const letras = barajar(lemario.siguientesLetras(prefijo), rng);
    const libres = vecinos(celda.q, celda.r)
      .map((v) => rejilla.get(clave(v.q, v.r)))
      .filter((v) => v && !usadas.has(clave(v.q, v.r)));
    for (const vecina of barajar(libres, rng)) {
      for (const letra of letras) {
        if (agotado()) return;
        expandir(vecina, letra, prefijo, cruces, asignadas, cambios);
      }
    }
  }

  const inicios = barajar([...rejilla.values()], rng);
  const primeras = barajar(lemario.siguientesLetras(''), rng);
  for (const inicio of inicios) {
    for (const letra of primeras) {
      if (agotado()) return resultado;
      expandir(inicio, letra, '', 0, 0, 0);
    }
  }
  return resultado;
}
