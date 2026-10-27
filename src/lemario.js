// Lemario: normalización, trie de palabras, etiquetas de temática y utilidades aleatorias.
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

// Etiqueta de temática: minúsculas, sin tildes y con los espacios internos reducidos a uno.
export function normalizarEtiqueta(etiqueta) {
  return normalizar(String(etiqueta).trim()).replace(/\s+/g, ' ');
}

class Lemario {
  // etiquetas: Map<etiqueta, string[]> con las palabras de cada temática.
  constructor(palabras, etiquetas = new Map()) {
    this.raiz = new Map();
    this.palabras = palabras;
    this.etiquetas = etiquetas;
    this._porLongitud = new Map();
    this._pares = new Map();
    this._longitudMaxima = 0;
    for (const p of palabras) {
      if (!this._porLongitud.has(p.length)) this._porLongitud.set(p.length, []);
      this._porLongitud.get(p.length).push(p);
      this._longitudMaxima = Math.max(this._longitudMaxima, p.length);
      for (let i = 0; i < p.length - 1; i++) {
        const par = p[i] + p[i + 1];
        this._pares.set(par, (this._pares.get(par) ?? 0) + 1);
      }
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

  // Etiquetas de temática disponibles, en orden alfabético.
  get listaEtiquetas() {
    return [...this.etiquetas.keys()].sort();
  }

  palabrasDeEtiqueta(etiqueta) {
    return this.etiquetas.get(normalizarEtiqueta(etiqueta)) ?? [];
  }

  get longitudMaxima() {
    return this._longitudMaxima;
  }

  palabrasDeLongitud(n) {
    return this._porLongitud.get(n) ?? [];
  }

  siguientesLetras(prefijo) {
    const nodo = this._nodo(prefijo);
    if (!nodo) return [];
    return [...nodo.keys()].filter((c) => c !== '$').sort();
  }

  frecuenciaPar(a, b) {
    return this._pares.get(a + b) ?? 0;
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

// Una palabra por línea. Tras un «;» opcional van sus etiquetas de temática separadas por comas
// («calabaza;halloween,otoño»). Una palabra sin etiquetas es general; si se repite, se juntan
// sus etiquetas.
export function cargarLemario(texto) {
  const unicas = new Set();
  const etiquetas = new Map();
  for (const linea of texto.split(/\r?\n/)) {
    const [palabra, resto = ''] = linea.split(';');
    const p = normalizar(palabra.trim());
    if (p.length < LONGITUD_MINIMA || !SOLO_LETRAS.test(p)) continue;
    unicas.add(p);
    for (const e of resto.split(',').map(normalizarEtiqueta)) {
      if (e === '') continue;
      if (!etiquetas.has(e)) etiquetas.set(e, new Set());
      etiquetas.get(e).add(p);
    }
  }
  return new Lemario([...unicas], new Map([...etiquetas].map(([e, ps]) => [e, [...ps]])));
}
