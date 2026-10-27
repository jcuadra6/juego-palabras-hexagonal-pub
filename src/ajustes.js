// Ajustes del jugador: valores por defecto, normalización y guardado en el dispositivo.
// Sin DOM: el almacén (localStorage o un sustituto) se recibe como parámetro.
import { normalizarAyuda, normalizarConfig } from './config.js';

export const CLAVE_AJUSTES = 'palabras-ajustes';

// Devuelve unos ajustes nuevos, completos y con valores válidos.
export function normalizarAjustes(ajustes) {
  const a = ajustes && typeof ajustes === 'object' ? ajustes : {};
  return {
    modo: a.modo === 'misiones' ? 'misiones' : 'supervivencia',
    tematica: typeof a.tematica === 'string' ? a.tematica : '', // '' = General
    mostrarLista: a.mostrarLista === true,
    develop: a.develop === true,
    generador: normalizarConfig(a.generador),
    ayuda: normalizarAyuda(a.ayuda),
  };
}

// Valor en una ruta con puntos («generador.longitudSembrada.min»).
export function leerRuta(objeto, ruta) {
  return ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), objeto);
}

// Ajustes nuevos con el valor cambiado en la ruta, ya normalizados. No modifica la entrada.
export function conRuta(ajustes, ruta, valor) {
  const copia = JSON.parse(JSON.stringify(ajustes));
  const claves = ruta.split('.');
  let o = copia;
  for (const k of claves.slice(0, -1)) {
    if (!o[k] || typeof o[k] !== 'object') o[k] = {};
    o = o[k];
  }
  o[claves[claves.length - 1]] = valor;
  return normalizarAjustes(copia);
}

// Lee los ajustes guardados; si no hay, están dañados o el almacén falla, usa los de por defecto.
export function leerAjustes(almacen) {
  try {
    return normalizarAjustes(JSON.parse(almacen?.getItem(CLAVE_AJUSTES) ?? 'null'));
  } catch {
    return normalizarAjustes();
  }
}

// Guarda los ajustes. Devuelve false si el almacén no está disponible o falla.
export function guardarAjustes(almacen, ajustes) {
  try {
    if (!almacen) return false;
    almacen.setItem(CLAVE_AJUSTES, JSON.stringify(ajustes));
    return true;
  } catch {
    return false;
  }
}
