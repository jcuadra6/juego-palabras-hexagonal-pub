// Partida: coordina una jugada completa (validar, puntuar, renovar, crecer, eventos y final).
import {
  caminoValido, palabraDeCamino, hayPalabraPosible, garantizarPalabraPosible, crearTableroInicial,
} from './tablero.js';
import { renovarLetras, crecer } from './crecimiento.js';
import { aplicarEvento, eventoDeMarca, modoActivo } from './eventos.js';
import { crearMision, actualizarMision, misionCumplida } from './modos.js';
import { normalizar } from './lemario.js';
import { clave } from './hex.js';
import { EVENTO_CADA_PALABRAS } from './config.js';

// ¿Se acabó el tablero? Solo si no hay palabra ni contando casillas congeladas (spec §3.5).
// Si solo hay palabra con congeladas, se descongela todo para no dejar al jugador bloqueado:
// el turno solo avanza con palabras aceptadas, así que la congelación no caducaría sola.
function sinJugadas(partida) {
  const { tablero, lemario } = partida;
  if (tablero.casillas.size === 0) return true;
  if (hayPalabraPosible(tablero, lemario)) return false;
  if (!hayPalabraPosible(tablero, lemario, { incluirCongeladas: true })) return true;
  for (const c of tablero.casillas.values()) c.congeladaHasta = 0;
  return false;
}

export function crearPartida({
  modo, tema = null, lemario, ia, rng, eventoCada = EVENTO_CADA_PALABRAS,
}) {
  const partida = {
    modo,
    tema,
    lemario,
    ia,
    rng,
    eventoCada,
    tablero: crearTableroInicial(lemario, rng),
    puntos: 0,
    palabrasUsadas: new Set(),
    eventosActivos: [],
    estado: 'jugando',
  };
  if (modo === 'misiones') partida.mision = crearMision(tema);
  if (sinJugadas(partida)) partida.estado = 'derrota';
  return partida;
}

// Lee las marcas del camino antes de que renovarLetras las borre.
function leerMarcas(tablero, camino) {
  let modo = null;
  const eliminar = [];
  const vistas = new Set();
  for (const p of camino) {
    const k = clave(p.q, p.r);
    if (vistas.has(k)) continue;
    vistas.add(k);
    const c = tablero.casilla(p.q, p.r);
    const m = c && c.especial;
    if (!m) continue;
    if (m.tipo === 'modo' && modo === null) modo = m.modo;
    else if (m.tipo === 'eliminar') eliminar.push({ q: c.q, r: c.r, especial: m });
  }
  return { modo, eliminar };
}

function registrarEvento(partida, evento) {
  aplicarEvento(partida.tablero, evento);
  // Un evento instantáneo con modo de crecimiento rige el siguiente crecimiento (1 turno).
  const duracion = evento.duracion > 0 ? evento.duracion : (evento.modoCrecimiento ? 1 : 0);
  if (duracion > 0) {
    partida.eventosActivos.push({ evento, hastaTurno: partida.tablero.turno + duracion });
  }
}

function reiniciarTablero(partida) {
  const turno = partida.tablero.turno;
  partida.tablero = crearTableroInicial(partida.lemario, partida.rng);
  partida.tablero.turno = turno;
  partida.eventosActivos = [];
}

export async function jugarPalabra(partida, camino) {
  if (partida.estado !== 'jugando') return { aceptada: false, motivo: 'partida-terminada' };
  if (partida.enCurso) return { aceptada: false, motivo: 'ocupada' };
  partida.enCurso = true;
  try {
    return await jugar(partida, camino);
  } finally {
    partida.enCurso = false;
  }
}

async function jugar(partida, camino) {
  const { tablero, lemario, rng } = partida;

  const valido = caminoValido(tablero, camino);
  if (!valido.valido) return { aceptada: false, motivo: valido.motivo };
  const palabra = palabraDeCamino(tablero, camino);
  const normal = normalizar(palabra);
  if (partida.palabrasUsadas.has(normal)) return { aceptada: false, motivo: 'repetida' };
  const veredicto = await partida.ia.validarPalabra(palabra, {
    tablero, modo: partida.modo, tema: partida.tema,
  });
  if (!veredicto.valida) return { aceptada: false, motivo: veredicto.motivo };

  const puntos = camino.length * camino.length;
  partida.puntos += puntos;
  partida.palabrasUsadas.add(normal);

  // Las marcas se leen antes de renovar: renovarLetras las borra.
  const marcas = leerMarcas(tablero, camino);
  renovarLetras(tablero, camino, lemario, rng);
  const modoCrecimiento = marcas.modo ?? modoActivo(partida.eventosActivos, tablero.turno);
  const { anadidas, rellenadas } = crecer(
    tablero, Math.max(1, Math.floor(camino.length / 2)), modoCrecimiento, lemario, rng,
  );
  garantizarPalabraPosible(tablero, lemario, rng);
  tablero.turno += 1;
  partida.eventosActivos = partida.eventosActivos.filter((e) => e.hastaTurno > tablero.turno);

  for (const m of marcas.eliminar) registrarEvento(partida, eventoDeMarca(m));
  let evento;
  let eventoError = false;
  if (partida.eventoCada > 0 && partida.palabrasUsadas.size % partida.eventoCada === 0) {
    try {
      evento = await partida.ia.siguienteEvento(
        { tablero, puntos: partida.puntos, palabrasUsadas: partida.palabrasUsadas },
        partida.modo, partida.tema,
      );
      if (evento) registrarEvento(partida, evento);
    } catch {
      // Un fallo de la IA equivale a "sin evento": la jugada ya está confirmada.
      evento = undefined;
      eventoError = true;
    }
  }

  let tableroReiniciado = false;
  if (partida.modo === 'misiones') {
    actualizarMision(
      partida.mision, { palabra, casillasRegeneradas: rellenadas }, partida.tema,
    );
    if (misionCumplida(partida.mision)) partida.estado = 'victoria';
    else if (sinJugadas(partida)) {
      reiniciarTablero(partida);
      tableroReiniciado = true;
    }
  } else if (sinJugadas(partida)) {
    partida.estado = 'derrota';
  }

  const res = { aceptada: true, palabra, puntos, anadidas };
  if (tableroReiniciado) res.tableroReiniciado = true;
  if (evento) res.evento = evento;
  if (eventoError) res.eventoError = true;
  return res;
}
