// Utilidades compartidas por los tests.
import { cargarLemario } from '../src/lemario.js';

const CONSONANTES = 'bcdfglmnprstv';
const VOCALES = 'aeiou';

// Lemario de hasta n palabras de 4 a 7 letras con consonante y vocal alternadas.
// Determinista para un rng dado. Si el espacio de palabras se agota, devuelve las que haya.
export function lemarioSintetico(n, rng) {
  const palabras = new Set();
  const elegir = (letras) => letras[Math.floor(rng() * letras.length)];
  let intentos = 0;
  while (palabras.size < n && intentos < n * 20) {
    intentos++;
    const largo = 4 + Math.floor(rng() * 4);
    let consonante = rng() < 0.5;
    let p = '';
    for (let i = 0; i < largo; i++) {
      p += elegir(consonante ? CONSONANTES : VOCALES);
      consonante = !consonante;
    }
    palabras.add(p);
  }
  return cargarLemario([...palabras].join('\n'));
}
