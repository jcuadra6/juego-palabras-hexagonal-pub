// Temas y misiones: validación de temas cargados desde JSON y progreso de los retos.
import { normalizar } from './lemario.js';

const TIPOS_EVENTO = ['eliminar', 'congelar', 'ocultar'];
const MODOS = ['rellenar', 'fuera', 'mixto', null];
const TIPOS_RETO = ['longitud', 'tema', 'regenerar'];
const CAMPOS_PALETA = ['fondo', 'casilla', 'texto', 'acento'];

const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const esNumero = (x) => typeof x === 'number' && Number.isFinite(x);

function validarEvento(e, i) {
  const ref = `eventos[${i}]`;
  if (!esObjeto(e)) throw new Error(`${ref} debe ser un objeto`);
  if (!TIPOS_EVENTO.includes(e.tipo)) throw new Error(`${ref}.tipo inválido: ${e.tipo}`);
  if (!esObjeto(e.alcance) || !esNumero(e.alcance.radio) || e.alcance.radio < 0) {
    throw new Error(`${ref}.alcance.radio inválido`);
  }
  if (!esNumero(e.duracion) || e.duracion < 0) throw new Error(`${ref}.duracion inválido`);
  if (!MODOS.includes(e.modoCrecimiento)) throw new Error(`${ref}.modoCrecimiento inválido`);
  return {
    tipo: e.tipo,
    alcance: { radio: e.alcance.radio },
    duracion: e.duracion,
    modoCrecimiento: e.modoCrecimiento,
  };
}

export function cargarTema(json) {
  if (!esObjeto(json)) throw new Error('tema inválido: debe ser un objeto');
  if (typeof json.nombre !== 'string' || json.nombre === '') throw new Error('nombre inválido o ausente');
  if (!Array.isArray(json.eventos) || json.eventos.length === 0) {
    throw new Error('eventos inválido o ausente: se espera una lista no vacía');
  }
  const eventos = json.eventos.map(validarEvento);
  if (!esObjeto(json.paleta)) throw new Error('paleta inválida o ausente');
  for (const c of CAMPOS_PALETA) {
    if (typeof json.paleta[c] !== 'string' || json.paleta[c] === '') {
      throw new Error(`paleta.${c} inválido o ausente`);
    }
  }
  if (!Array.isArray(json.palabrasObjetivo) || json.palabrasObjetivo.length === 0
    || !json.palabrasObjetivo.every((p) => typeof p === 'string' && p !== '')) {
    throw new Error('palabrasObjetivo inválido o ausente: se espera una lista no vacía de textos');
  }
  if (!Array.isArray(json.retos) || json.retos.length === 0) {
    throw new Error('retos inválido o ausente: se espera una lista no vacía');
  }
  const retos = json.retos.map((r, i) => {
    if (!esObjeto(r) || !TIPOS_RETO.includes(r.tipo) || !esNumero(r.meta) || r.meta <= 0) {
      throw new Error(`retos[${i}] inválido: tipo (${TIPOS_RETO.join('|')}) y meta numérica positiva`);
    }
    return { tipo: r.tipo, meta: r.meta };
  });
  return {
    nombre: json.nombre,
    paleta: { ...json.paleta },
    eventos,
    palabrasObjetivo: [...json.palabrasObjetivo],
    retos,
  };
}

export function crearMision(tema) {
  return {
    objetivos: tema.retos.map((r, i) => ({
      id: `${r.tipo}-${i}`,
      tipo: r.tipo,
      meta: r.meta,
      progreso: 0,
      cumplido: false,
      // Solo para el reto 'tema': palabras objetivo ya contadas (no cuentan dos veces).
      vistas: [],
    })),
  };
}

export function actualizarMision(mision, resultado, tema) {
  const palabra = normalizar(resultado.palabra);
  const objetivo = new Set(tema.palabrasObjetivo.map(normalizar));
  for (const o of mision.objetivos) {
    if (o.cumplido) continue;
    if (o.tipo === 'longitud') {
      o.progreso = Math.max(o.progreso, palabra.length);
    } else if (o.tipo === 'tema') {
      if (objetivo.has(palabra) && !o.vistas.includes(palabra)) {
        o.vistas.push(palabra);
        o.progreso += 1;
      }
    } else if (o.tipo === 'regenerar') {
      o.progreso += resultado.casillasRegeneradas;
    }
    o.cumplido = o.progreso >= o.meta;
  }
}

export function misionCumplida(mision) {
  return mision.objetivos.every((o) => o.cumplido);
}

// Avisos (no bloqueantes) cuando un lemario propio hace inalcanzables los retos del tema.
export function avisosLemario(tema, lemario) {
  if (!tema) return [];
  const avisos = [];
  const faltan = tema.palabrasObjetivo.filter((p) => !lemario.existe(p));
  if (faltan.length > 0) {
    avisos.push(`Faltan palabras del tema en el lemario: ${faltan.join(', ')}.`);
  }
  const maxLong = lemario.palabras.reduce((m, p) => Math.max(m, p.length), 0);
  for (const r of tema.retos) {
    if (r.tipo === 'longitud' && maxLong < r.meta) {
      avisos.push(`Ninguna palabra del lemario llega a ${r.meta} letras.`);
    }
  }
  return avisos;
}
