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
  if (evento.duracion > 0) {
    partida.eventosActivos.push({ evento, hastaTurno: partida.tablero.turno + evento.duracion });
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
  if (partida.eventoCada > 0 && partida.palabrasUsadas.size % partida.eventoCada === 0) {
    evento = await partida.ia.siguienteEvento(
      { tablero, puntos: partida.puntos, palabrasUsadas: partida.palabrasUsadas },
      partida.modo, partida.tema,
    );
    if (evento) registrarEvento(partida, evento);
  }

  if (partida.modo === 'misiones') {
    actualizarMision(
      partida.mision, { palabra, casillasRegeneradas: rellenadas }, partida.tema,
    );
    if (misionCumplida(partida.mision)) partida.estado = 'victoria';
    else if (partida.tablero.casillas.size === 0 || !hayPalabraPosible(partida.tablero, lemario)) {
      reiniciarTablero(partida);
    }
  } else if (tablero.casillas.size === 0 || !hayPalabraPosible(tablero, lemario)) {
    partida.estado = 'derrota';
  }

  const res = { aceptada: true, palabra, puntos, anadidas };
  if (evento) res.evento = evento;
  return res;
}
