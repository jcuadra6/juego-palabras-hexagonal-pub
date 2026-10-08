// Eventos como datos: alcance, aplicación sobre el tablero y modo de crecimiento activo.
import { distancia } from './hex.js';
import { eliminarCasillas } from './crecimiento.js';
import { MODO_POR_DEFECTO } from './config.js';

// Plantillas: el alcance solo lleva el radio; la IA añade el centro.
export const EVENTOS_BASE = [
  { tipo: 'eliminar', alcance: { radio: 1 }, duracion: 0, modoCrecimiento: null },
  { tipo: 'congelar', alcance: { radio: 1 }, duracion: 3, modoCrecimiento: null },
  { tipo: 'congelar', alcance: { radio: 2 }, duracion: 2, modoCrecimiento: 'rellenar' },
  { tipo: 'ocultar', alcance: { radio: 2 }, duracion: 4, modoCrecimiento: null },
  { tipo: 'ocultar', alcance: { radio: 1 }, duracion: 2, modoCrecimiento: 'fuera' },
  { tipo: 'eliminar', alcance: { radio: 2 }, duracion: 0, modoCrecimiento: 'fuera' },
];

export function casillasEnAlcance(tablero, alcance) {
  if (alcance.claves) return alcance.claves.filter((k) => tablero.casillas.has(k));
  if (!alcance.centro) return [];
  const res = [];
  for (const [k, c] of tablero.casillas) {
    if (distancia(alcance.centro, c) <= alcance.radio) res.push(k);
  }
  return res;
}

export function aplicarEvento(tablero, evento) {
  const claves = casillasEnAlcance(tablero, evento.alcance);
  if (evento.tipo === 'eliminar') {
    eliminarCasillas(tablero, claves);
    return;
  }
  const campo = evento.tipo === 'congelar' ? 'congeladaHasta' : 'ocultaHasta';
  for (const k of claves) tablero.casillas.get(k)[campo] = tablero.turno + evento.duracion;
}

export function eventoDeMarca(casilla) {
  if (!casilla || !casilla.especial || casilla.especial.tipo !== 'eliminar') return null;
  return {
    tipo: 'eliminar',
    alcance: { centro: { q: casilla.q, r: casilla.r }, radio: 1 },
    duracion: 0,
    modoCrecimiento: null,
  };
}

export function modoActivo(eventosActivos, turno, porDefecto = MODO_POR_DEFECTO) {
  for (let i = eventosActivos.length - 1; i >= 0; i--) {
    const { evento, hastaTurno } = eventosActivos[i];
    if (hastaTurno > turno && evento.modoCrecimiento) return evento.modoCrecimiento;
  }
  return porDefecto;
}
