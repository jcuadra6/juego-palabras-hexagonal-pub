// Prepara el lemario por defecto a partir del de teoruiz (una palabra por línea, UTF-8).
// Uso: node scripts/preparar-lemario.mjs lemario-20101017.txt > data/lemario.txt
// Descarta prefijos y sufijos (con guion), locuciones (con espacios) y nombres propios o siglas
// (empiezan por mayúscula); el resto se normaliza como en el juego, sin repetidas y ordenado.
import { readFileSync } from 'node:fs';
import { normalizar } from '../src/lemario.js';
import { LONGITUD_MINIMA } from '../src/config.js';

const SOLO_LETRAS = /^[a-zñ]+$/;

export function prepararLemario(texto) {
  const unicas = new Set();
  for (const linea of texto.split(/\r?\n/)) {
    const bruta = linea.trim();
    if (bruta === '' || /[\s-]/.test(bruta) || bruta[0] !== bruta[0].toLowerCase()) continue;
    const p = normalizar(bruta);
    if (p.length >= LONGITUD_MINIMA && SOLO_LETRAS.test(p)) unicas.add(p);
  }
  return [...unicas].sort();
}

if (process.argv[2]) {
  process.stdout.write(`${prepararLemario(readFileSync(process.argv[2], 'utf8')).join('\n')}\n`);
}
