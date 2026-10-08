// Lemario: normalización, trie de palabras y utilidades aleatorias.
import { LONGITUD_MINIMA, FRECUENCIAS_LETRAS } from './config.js';

const MARCA_ENE = '\u0001';

export function normalizar(palabra) {
  return String(palabra)
    .toLowerCase()
    .replace(/ñ/g, MARCA_ENE)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(new RegExp(MARCA_ENE, 'g'), 'ñ');
}

const SOLO_LETRAS = /^[a-zñ]+$/;

class Lemario {
  constructor(palabras) {
    this.raiz = new Map();
    this.palabras = palabras;
    for (const p of palabras) {
      let nodo = this.raiz;
      for (const c of p) {
        if (!nodo.has(c)) nodo.set(c, new Map());
        nodo = nodo.get(c);
      }
      nodo.set('$', true);
    }
  }

  get tamano() {
    return this.palabras.length;
  }

  _nodo(texto) {
    let nodo = this.raiz;
    for (const c of normalizar(texto)) {
      nodo = nodo.get(c);
      if (!nodo) return null;
    }
    return nodo;
  }

  existe(palabra) {
    const nodo = this._nodo(palabra);
    return nodo !== null && nodo.has('$');
  }

  esPrefijo(prefijo) {
    return this._nodo(prefijo) !== null;
  }

  letraAleatoria(rng) {
    const entradas = Object.entries(FRECUENCIAS_LETRAS);
    const total = entradas.reduce((s, [, f]) => s + f, 0);
    let r = rng() * total;
    for (const [letra, f] of entradas) {
      r -= f;
      if (r < 0) return letra;
    }
    return entradas[entradas.length - 1][0];
  }

  palabraAleatoria(rng, longitud = 3) {
    const candidatas = this.palabras.filter((p) => p.length === longitud);
    if (candidatas.length === 0) return null;
    return candidatas[Math.floor(rng() * candidatas.length)];
  }
}

export function cargarLemario(texto) {
  const unicas = new Set();
  for (const linea of texto.split(/\r?\n/)) {
    const p = normalizar(linea.trim());
    if (p.length >= LONGITUD_MINIMA && SOLO_LETRAS.test(p)) unicas.add(p);
  }
  return new Lemario([...unicas]);
}
