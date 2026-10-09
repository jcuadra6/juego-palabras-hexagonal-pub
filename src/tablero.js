// Tablero hexagonal: casillas, caminos y comprobación de palabras posibles.
import { clave, vecinos, anillo } from './hex.js';
import { LONGITUD_MINIMA, RADIO_INICIAL } from './config.js';

export class Tablero {
  constructor() {
    this.casillas = new Map();
    this.huecos = new Set();
    this.turno = 0;
  }

  casilla(q, r) {
    return this.casillas.get(clave(q, r));
  }

  poner(q, r, letra) {
    const k = clave(q, r);
    const c = { q, r, letra, especial: null, congeladaHasta: 0, ocultaHasta: 0 };
    this.casillas.set(k, c);
    this.huecos.delete(k);
    return c;
  }
}

export function tableroDesde(lista) {
  const t = new Tablero();
  for (const { q, r, letra } of lista) t.poner(q, r, letra);
  return t;
}

function sonVecinas(a, b) {
  return vecinos(a.q, a.r).some((v) => v.q === b.q && v.r === b.r);
}

export function caminoValido(tablero, camino) {
  if (camino.length < LONGITUD_MINIMA) return { valido: false, motivo: 'corto' };
  for (const p of camino) {
    if (!tablero.casilla(p.q, p.r)) return { valido: false, motivo: 'no-existe' };
  }
  for (let i = 1; i < camino.length; i++) {
    const a = camino[i - 1];
    const b = camino[i];
    if (a.q === b.q && a.r === b.r) return { valido: false, motivo: 'repetida-consecutiva' };
    if (!sonVecinas(a, b)) return { valido: false, motivo: 'no-vecinas' };
  }
  for (const p of camino) {
    if (tablero.casilla(p.q, p.r).congeladaHasta > tablero.turno) {
      return { valido: false, motivo: 'congelada' };
    }
  }
  return { valido: true };
}

export function palabraDeCamino(tablero, camino) {
  return camino.map((p) => tablero.casilla(p.q, p.r).letra).join('');
}

// Por defecto solo cuentan las casillas libres; con incluirCongeladas también las congeladas.
export function hayPalabraPosible(tablero, lemario, { incluirCongeladas = false } = {}) {
  const maxLong = lemario.palabras.reduce((m, p) => Math.max(m, p.length), 0);
  if (maxLong < LONGITUD_MINIMA) return false;
  const libres = [...tablero.casillas.values()].filter((c) => incluirCongeladas || c.congeladaHasta <= tablero.turno);
  const libreKeys = new Set(libres.map((c) => clave(c.q, c.r)));
  const vecinosDe = new Map();
  for (const c of libres) {
    vecinosDe.set(
      clave(c.q, c.r),
      vecinos(c.q, c.r).map((v) => tablero.casilla(v.q, v.r))
        .filter((v) => v && libreKeys.has(clave(v.q, v.r))),
    );
  }
  // Memo de estados (casilla, prefijo) ya explorados sin éxito.
  const fallidos = new Set();
  function dfs(c, prefijo) {
    const texto = prefijo + c.letra;
    if (!lemario.esPrefijo(texto)) return false;
    if (texto.length >= LONGITUD_MINIMA && lemario.existe(texto)) return true;
    if (texto.length >= maxLong) return false;
    const k = `${clave(c.q, c.r)}|${texto}`;
    if (fallidos.has(k)) return false;
    for (const v of vecinosDe.get(clave(c.q, c.r))) {
      if (dfs(v, texto)) return true;
    }
    fallidos.add(k);
    return false;
  }
  return libres.some((c) => dfs(c, ''));
}

const MAX_CAMINOS = 5000;

// Caminos de n casillas libres distintas (cada una vecina de la anterior), en orden estable.
function caminosLibres(tablero, n, libre) {
  const caminos = [];
  const actual = [];
  function extender(c) {
    if (caminos.length >= MAX_CAMINOS) return;
    actual.push(c);
    if (actual.length === n) {
      caminos.push([...actual]);
    } else {
      for (const v of vecinos(c.q, c.r)) {
        const sig = tablero.casilla(v.q, v.r);
        if (libre(sig) && !actual.includes(sig)) extender(sig);
      }
    }
    actual.pop();
  }
  for (const a of tablero.casillas.values()) if (libre(a)) extender(a);
  return caminos;
}

export function garantizarPalabraPosible(tablero, lemario, rng) {
  if (hayPalabraPosible(tablero, lemario)) return true;
  // Longitud más corta disponible (3 si existe; si no, la menor del lemario).
  const longitud = lemario.palabras.reduce((m, p) => Math.min(m, p.length), Infinity);
  if (!Number.isFinite(longitud)) return false;
  const palabra = lemario.palabraAleatoria(rng, Math.max(LONGITUD_MINIMA, longitud));
  if (!palabra) return false;
  const libre = (c) => c && c.congeladaHasta <= tablero.turno;
  const cadenas = caminosLibres(tablero, palabra.length, libre);
  if (cadenas.length === 0) return false;
  const cadena = cadenas[Math.floor(rng() * cadenas.length)];
  cadena.forEach((casilla, i) => { casilla.letra = palabra[i]; });
  return true;
}

export function crearTableroInicial(lemario, rng) {
  const t = new Tablero();
  const celdas = [{ q: 0, r: 0 }];
  for (let radio = 1; radio <= RADIO_INICIAL; radio++) celdas.push(...anillo(radio));
  for (const { q, r } of celdas) t.poner(q, r, lemario.letraAleatoria(rng));
  garantizarPalabraPosible(t, lemario, rng);
  return t;
}
