// Conecta la lógica del juego con la interfaz web (todo en el navegador, sin servidor).
import { crearPartida, jugarPalabra } from './partida.js';
import { cargarLemario } from './lemario.js';
import { cargarTema } from './modos.js';
import { crearIaSimulada } from './ia.js';
import { crearRng } from './rng.js';
import {
  dibujarTablero, marcarCamino, extenderCamino, textoPalabra, estaCongelada,
} from './ui.js';

const TAMANO = 30;
const TEMAS = ['halloween', 'navidad'];
const PALETA_NEUTRA = {
  fondo: '#1f2933', casilla: '#3e4c59', texto: '#f5f7fa', acento: '#4dabf7',
};
const MOTIVOS = {
  corto: 'La palabra es demasiado corta (mínimo 3 letras).',
  'no-esta-en-el-lemario': 'Esa palabra no está en el lemario.',
  repetida: 'Ya has usado esa palabra.',
  congelada: 'Hay casillas congeladas en el camino.',
  'repetida-consecutiva': 'No puedes repetir la misma casilla seguida.',
  'no-vecinas': 'Las casillas deben ser vecinas.',
  'no-existe': 'El camino pasa por una casilla que no existe.',
  'partida-terminada': 'La partida ha terminado.',
};
const TIPOS_EVENTO = { eliminar: 'Eliminar casillas', congelar: 'Congelar casillas', ocultar: 'Ocultar letras' };
const TIPOS_RETO = {
  longitud: (m) => `Forma una palabra de ${m} letras`,
  tema: (m) => `Forma ${m} palabras del tema`,
  regenerar: (m) => `Regenera ${m} casillas`,
};

const $ = (id) => document.getElementById(id);
const el = {
  svg: $('tablero'), modo: $('modo'), tema: $('tema'), archivo: $('lemario-archivo'),
  nueva: $('nueva'), puntos: $('puntos'), modoActual: $('modo-actual'), eventos: $('eventos'),
  objetivos: $('objetivos'), palabra: $('palabra'), enviar: $('enviar'), borrar: $('borrar'),
  mensaje: $('mensaje'),
};

const estado = { lemario: null, temas: {}, partida: null, camino: [], ocupado: false, arrastre: null };

function mostrarMensaje(texto, clase = '') {
  el.mensaje.textContent = texto;
  el.mensaje.className = clase;
}

function aplicarPaleta(paleta) {
  const raiz = document.documentElement.style;
  for (const [k, v] of Object.entries(paleta)) raiz.setProperty(`--${k}`, v);
}

function renderPanel() {
  const p = estado.partida;
  el.puntos.textContent = p.puntos;
  el.modoActual.textContent = p.modo === 'misiones' ? `Misiones (${p.tema.nombre})` : 'Supervivencia';
  const turno = p.tablero.turno;
  const activos = p.eventosActivos.filter((e) => e.hastaTurno > turno);
  el.eventos.textContent = activos.length === 0
    ? 'Evento activo: ninguno'
    : `Evento activo: ${activos.map((e) => `${TIPOS_EVENTO[e.evento.tipo]} (${e.hastaTurno - turno} turnos)`).join(', ')}`;
  el.objetivos.replaceChildren();
  if (p.mision) {
    for (const o of p.mision.objetivos) {
      const li = document.createElement('li');
      li.textContent = `${TIPOS_RETO[o.tipo](o.meta)}: ${Math.min(o.progreso, o.meta)}/${o.meta}`;
      if (o.cumplido) li.className = 'cumplido';
      el.objetivos.appendChild(li);
    }
  }
}

function render() {
  const p = estado.partida;
  dibujarTablero(el.svg, p, TAMANO); // lee p.tablero cada vez: misiones lo reemplaza al reiniciar
  marcarCamino(el.svg, estado.camino);
  el.palabra.textContent = textoPalabra(p.tablero, estado.camino) || ' ';
  const activa = p.estado === 'jugando' && !estado.ocupado;
  el.enviar.disabled = !activa || estado.camino.length === 0;
  el.borrar.disabled = !activa || estado.camino.length === 0;
  renderPanel();
}

function cambiarCamino(camino) {
  estado.camino = camino;
  marcarCamino(el.svg, camino);
  el.palabra.textContent = textoPalabra(estado.partida.tablero, camino) || ' ';
  el.enviar.disabled = camino.length === 0;
  el.borrar.disabled = camino.length === 0;
}

function celdaDeElemento(elemento) {
  const k = elemento && elemento.dataset ? elemento.dataset.clave : null;
  if (!k) return null;
  const [q, r] = k.split(',').map(Number);
  const c = estado.partida.tablero.casilla(q, r);
  return c && !estaCongelada(estado.partida.tablero, c) ? { q, r } : null;
}

async function enviar() {
  const p = estado.partida;
  if (estado.ocupado || p.estado !== 'jugando' || estado.camino.length === 0) return;
  estado.ocupado = true;
  el.enviar.disabled = true;
  el.borrar.disabled = true;
  const camino = estado.camino;
  let res;
  try {
    res = await jugarPalabra(p, camino);
  } catch (e) {
    if (estado.partida !== p) return; // otra partida ocupa ya la interfaz
    estado.ocupado = false;
    estado.camino = [];
    mostrarMensaje(`Error al validar la palabra: ${e.message}`, 'derrota');
    render();
    return;
  }
  if (estado.partida !== p) return; // se empezó otra partida durante la jugada: se descarta
  estado.ocupado = false;
  if (res.aceptada) {
    estado.camino = [];
    let texto = `«${res.palabra}»: +${res.puntos} puntos, ${res.anadidas} casilla(s) nueva(s).`;
    if (res.evento) texto += ` Evento: ${TIPOS_EVENTO[res.evento.tipo]}.`;
    if (p.estado === 'victoria') mostrarMensaje(`¡Victoria! Misión cumplida con ${p.puntos} puntos.`, 'victoria');
    else if (p.estado === 'derrota') mostrarMensaje(`Derrota: el tablero se quedó sin jugadas. Puntos: ${p.puntos}.`, 'derrota');
    else mostrarMensaje(texto);
  } else {
    estado.camino = [];
    mostrarMensaje(MOTIVOS[res.motivo] ?? 'Palabra no válida.');
  }
  render();
}

function alPulsar(ev) {
  const p = estado.partida;
  if (estado.ocupado || p.estado !== 'jugando') return;
  const celda = celdaDeElemento(ev.target);
  if (!celda) return;
  ev.preventDefault();
  const nuevo = extenderCamino(estado.camino, celda, { arrastre: false });
  estado.arrastre = { celdas: nuevo.length, movido: false };
  cambiarCamino(nuevo);
}

function alMover(ev) {
  if (!estado.arrastre || estado.ocupado) return;
  const celda = celdaDeElemento(document.elementFromPoint(ev.clientX, ev.clientY));
  if (!celda) return;
  const nuevo = extenderCamino(estado.camino, celda, { arrastre: true });
  if (nuevo !== estado.camino) {
    estado.arrastre.movido = true;
    cambiarCamino(nuevo);
  }
}

function alSoltar() {
  const arrastre = estado.arrastre;
  estado.arrastre = null;
  // Solo se envía al soltar si realmente se arrastró; un toque suelto solo selecciona.
  if (arrastre && arrastre.movido && estado.camino.length > 1) enviar().catch((e) => mostrarMensaje(`Error: ${e.message}`, 'derrota'));
}

async function nuevaPartida() {
  if (!estado.lemario) return;
  const modo = el.modo.value;
  const tema = modo === 'misiones' ? estado.temas[el.tema.value] : null;
  el.tema.disabled = modo !== 'misiones';
  aplicarPaleta(tema ? tema.paleta : PALETA_NEUTRA);
  const rng = crearRng(Date.now());
  estado.partida = crearPartida({
    modo, tema, lemario: estado.lemario, ia: crearIaSimulada({ lemario: estado.lemario, rng }), rng,
  });
  estado.camino = [];
  estado.ocupado = false;
  estado.arrastre = null;
  mostrarMensaje('');
  render();
}

async function cargarTextoLemario(texto) {
  const lemario = cargarLemario(texto);
  if (lemario.palabras.length === 0) throw new Error('el lemario no tiene palabras válidas');
  estado.lemario = lemario;
}

async function iniciar() {
  try {
    const [texto, ...temas] = await Promise.all([
      fetch('data/lemario-muestra.txt').then((r) => r.text()),
      ...TEMAS.map((t) => fetch(`data/temas/${t}.json`).then((r) => r.json())),
    ]);
    await cargarTextoLemario(texto);
    TEMAS.forEach((t, i) => { estado.temas[t] = cargarTema(temas[i]); });
  } catch (e) {
    mostrarMensaje(`No se pudieron cargar los datos: ${e.message}`, 'derrota');
    return;
  }
  el.svg.addEventListener('pointerdown', alPulsar);
  el.svg.addEventListener('pointermove', alMover);
  document.addEventListener('pointerup', alSoltar);
  document.addEventListener('pointercancel', () => { estado.arrastre = null; });
  el.enviar.addEventListener('click', enviar);
  el.borrar.addEventListener('click', () => { if (!estado.ocupado) cambiarCamino([]); });
  el.nueva.addEventListener('click', nuevaPartida);
  el.modo.addEventListener('change', nuevaPartida);
  el.tema.addEventListener('change', nuevaPartida);
  el.archivo.addEventListener('change', async () => {
    const f = el.archivo.files[0];
    if (!f) return;
    try {
      await cargarTextoLemario(await f.text());
      await nuevaPartida();
      mostrarMensaje(`Lemario cargado: ${estado.lemario.palabras.length} palabras.`);
    } catch (e) {
      mostrarMensaje(`Lemario no válido: ${e.message}`, 'derrota');
    }
  });
  await nuevaPartida();
}

iniciar();
