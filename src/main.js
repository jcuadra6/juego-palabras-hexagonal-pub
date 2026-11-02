// Conecta la lógica del juego con la interfaz web (todo en el navegador, sin servidor).
import { crearPartida, jugarPalabra } from './partida.js';
import { cargarLemario } from './lemario.js';
import {
  avisosLemario, cargarTema, claveDeTema, lemarioDePartida, nombreTematica, temaDeTematica,
} from './modos.js';
import { crearIaSimulada } from './ia.js';
import { crearRng } from './rng.js';
import {
  dibujarTablero, marcarCamino, extenderCamino, textoPalabra, estaCongelada,
  alternarSeleccion, reconciliarSeleccion, dibujarMarca, borrarMarca, siguientePista,
} from './ui.js';
import { escanearPalabras } from './escaner.js';
import { conRuta, guardarAjustes, leerAjustes, leerRuta, normalizarAjustes } from './ajustes.js';
import { borrarGuardado, guardar, leerGuardado } from './almacen.js';

const TAMANO = 30;
const TEMAS = ['general', 'halloween', 'navidad'];
const TEMATICAS = ['halloween', 'navidad']; // lemarios con etiquetas incluidos (data/tematicas)
const GUARDADO_LEMARIO = 'lemario-propio'; // { nombre, texto }
const GUARDADO_TEMATICAS = 'tematicas-propias'; // [{ nombre, texto }]
const GUARDADO_ESTILOS = 'estilos-propios'; // [{ nombre, json }]: temas (.json) cargados en Ajustes
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
  ocupada: 'Hay una jugada en curso.',
};
const TIPOS_EVENTO = { eliminar: 'Eliminar casillas', congelar: 'Congelar casillas', ocultar: 'Ocultar letras' };
const TIPOS_RETO = {
  longitud: (m) => `Forma una palabra de ${m} letras`,
  tema: (m, tema) => (tema.palabrasObjetivo ? `Forma ${m} palabras de ${tema.nombre}` : `Forma ${m} palabras distintas`),
  regenerar: (m) => `Regenera ${m} casillas`,
};

const $ = (id) => document.getElementById(id);
const el = {
  svg: $('tablero'), modo: $('modo'), tematica: $('tematica'), archivo: $('lemario-archivo'),
  nueva: $('nueva'), puntos: $('puntos'), modoActual: $('modo-actual'), eventos: $('eventos'),
  objetivos: $('objetivos'), palabra: $('palabra'), enviar: $('enviar'), borrar: $('borrar'),
  mensaje: $('mensaje'), pagina: document.querySelector('.pagina'), panelAyuda: $('panel-ayuda'),
  ayudaTitulo: $('ayuda-titulo'), ayudaAviso: $('ayuda-aviso'), ayudaLista: $('ayuda-lista'),
  chkAyuda: $('chk-ayuda'), chkDevelop: $('chk-develop'), pedirAyuda: $('pedir-ayuda'),
  ajustes: $('ajustes'), abrirAjustes: $('abrir-ajustes'), cerrarAjustes: $('cerrar-ajustes'), ajustesMensaje: $('ajustes-mensaje'),
  lemarioEstado: $('lemario-estado'), lemarioDefecto: $('lemario-defecto'),
  tematicasLista: $('tematicas-lista'), tematicasArchivo: $('tematicas-archivo'),
  tematicasQuitar: $('tematicas-quitar'), parametrosDefecto: $('parametros-defecto'),
  cargaTematicas: document.querySelectorAll('input[name="carga-tematicas"]'),
  parametros: document.querySelectorAll('[data-ruta]'),
};

// localStorage puede no existir o lanzar (navegación privada): entonces no se recuerda nada.
const almacenAjustes = (() => { try { return window.localStorage; } catch { return null; } })();

const estado = { lemario: null, temas: {}, partida: null, camino: [], ocupado: false, arrastre: null,
  ajustes: leerAjustes(almacenAjustes),
  // Textos de los que sale el lemario activo: el general (por defecto o propio) y los de temáticas.
  fuentes: { porDefecto: '', propio: null, tematicasIncluidas: [], tematicasPropias: [], estilosPropios: [] },
  temasIncluidos: {}, // los de data/temas; estado.temas les suma los estilos propios
  lemarioGeneral: null, // solo el general (propio o por defecto)
  lemarioCompleto: null, // el general con todos los lemarios de temáticas
  lemariosPorEtiqueta: new Map(), // caché de lemarios por modo de carga y etiqueta
  pista: null, // { palabra, camino } marcada por «Pedir ayuda»
  ayuda: { panel: false, develop: false, palabras: [], truncado: false, seleccionada: null },
};

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
      li.textContent = `${TIPOS_RETO[o.tipo](o.meta, p.tema)}: ${Math.min(o.progreso, o.meta)}/${o.meta}`;
      if (o.cumplido) li.className = 'cumplido';
      el.objetivos.appendChild(li);
    }
  }
}

// Escanea las palabras posibles; solo con el panel encendido y con partida.
function escanear() {
  const a = estado.ayuda;
  if (!a.panel || !estado.partida) {
    a.palabras = [];
    a.truncado = false;
    a.seleccionada = null;
    return;
  }
  const res = escanearPalabras(estado.partida.tablero, estado.lemario, { ...estado.ajustes.ayuda, excluir: estado.partida.palabrasUsadas });
  a.palabras = res.palabras;
  a.truncado = res.truncado;
  a.seleccionada = reconciliarSeleccion(a.seleccionada, a.palabras);
}

function renderMarca() {
  const a = estado.ayuda;
  // La pista se marca siempre y tiene prioridad sobre la selección del panel.
  const elegida = estado.pista ?? (a.panel && a.develop && a.seleccionada
    ? a.palabras.find((p) => p.palabra === a.seleccionada)
    : null);
  if (elegida) dibujarMarca(el.svg, elegida.camino, TAMANO);
  else borrarMarca(el.svg);
}

function renderAyuda() {
  const a = estado.ayuda;
  el.panelAyuda.hidden = !a.panel;
  el.pagina.classList.toggle('con-ayuda', a.panel);
  el.ayudaTitulo.textContent = `Palabras posibles (${a.palabras.length})`;
  el.ayudaAviso.hidden = !a.truncado;
  el.ayudaLista.replaceChildren();
  for (const p of a.palabras) {
    const li = document.createElement('li');
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.dataset.palabra = p.palabra;
    boton.setAttribute('aria-pressed', String(p.palabra === a.seleccionada));
    const texto = document.createElement('span');
    texto.textContent = p.palabra.toUpperCase();
    const puntos = document.createElement('span');
    puntos.textContent = p.puntos;
    boton.append(texto, puntos);
    boton.addEventListener('click', () => {
      a.seleccionada = alternarSeleccion(a.seleccionada, p.palabra);
      // No se reconstruye la lista: así el botón conserva el foco del teclado.
      for (const b of el.ayudaLista.querySelectorAll('button')) {
        b.setAttribute('aria-pressed', String(b.dataset.palabra === a.seleccionada));
      }
      renderMarca();
    });
    li.appendChild(boton);
    el.ayudaLista.appendChild(li);
  }
  renderMarca();
}

function render() {
  const p = estado.partida;
  dibujarTablero(el.svg, p, TAMANO); // lee p.tablero cada vez: misiones lo reemplaza al reiniciar
  marcarCamino(el.svg, estado.camino);
  el.palabra.textContent = textoPalabra(p.tablero, estado.camino) || ' ';
  const activa = p.estado === 'jugando' && !estado.ocupado;
  el.enviar.disabled = !activa || estado.camino.length === 0;
  el.borrar.disabled = !activa || estado.camino.length === 0;
  el.pedirAyuda.disabled = !activa;
  renderPanel();
  escanear();
  renderAyuda(); // el SVG se vació al redibujar: la marca se dibuja de nuevo aquí
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
  if (!p || estado.ocupado || p.estado !== 'jugando' || estado.camino.length === 0) return;
  estado.ocupado = true;
  el.enviar.disabled = true;
  el.borrar.disabled = true;
  el.pedirAyuda.disabled = true;
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
    estado.pista = null;
    let texto = `«${res.palabra}»: +${res.puntos} puntos, ${res.anadidas} casilla(s) nueva(s).`;
    if (res.evento) texto += ` Evento: ${TIPOS_EVENTO[res.evento.tipo]}.`;
    if (res.tableroReiniciado) estado.ayuda.seleccionada = null;
    if (res.tableroReiniciado) texto += ' No quedaban palabras posibles: el tablero se ha reiniciado.';
    if (p.estado === 'victoria') mostrarMensaje(`¡Victoria! Misión cumplida con ${p.puntos} puntos.`, 'victoria');
    else if (p.estado === 'derrota') mostrarMensaje(`Derrota: no queda ninguna palabra posible en el tablero. Puntos: ${p.puntos}.`, 'derrota');
    else mostrarMensaje(texto);
  } else {
    estado.camino = [];
    mostrarMensaje(MOTIVOS[res.motivo] ?? 'Palabra no válida.');
  }
  render();
}

// Marca en el tablero la palabra posible siguiente a la pista actual.
function pedirAyuda() {
  const p = estado.partida;
  if (!p || estado.ocupado || p.estado !== 'jugando') return;
  const { palabras } = escanearPalabras(p.tablero, estado.lemario, { ...estado.ajustes.ayuda, excluir: p.palabrasUsadas });
  estado.pista = siguientePista(palabras, estado.pista?.palabra ?? null);
  mostrarMensaje(estado.pista ? '' : 'No hay palabras posibles ahora mismo.');
  renderMarca();
}

function alPulsar(ev) {
  const p = estado.partida;
  if (!p || estado.ocupado || p.estado !== 'jugando') return;
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

const MENSAJES_CARGA = {
  separadas: 'Cada temática por separado: sus palabras solo valen en su temática, junto con las del general.',
  exclusiva: 'Solo la temática: en una temática solo valen sus palabras (General sigue usando el general).',
  juntas: 'Todas juntas: las palabras de todas las temáticas valen en cualquier partida.',
};

// «1 palabra», «84.520 palabras».
const contarPalabras = (n) => `${n.toLocaleString('es-ES')} ${n === 1 ? 'palabra' : 'palabras'}`;

function guardarAjustesActuales() {
  guardarAjustes(almacenAjustes, estado.ajustes);
}

async function nuevaPartida() {
  if (!estado.lemario) return;
  const modo = el.modo.value;
  el.tematica.disabled = modo !== 'misiones';
  if (modo === 'misiones' && !estado.temas.general) {
    mostrarMensaje('No hay temas cargados: usa supervivencia.', 'derrota');
    return;
  }
  estado.lemario = lemarioActivo(modo === 'misiones' ? el.tematica.value : '');
  const tema = modo === 'misiones' ? temaDeTematica(estado.temas, estado.lemario, el.tematica.value) : null;
  aplicarPaleta(tema ? tema.paleta : PALETA_NEUTRA);
  const rng = crearRng(Date.now());
  estado.partida = crearPartida({
    modo, tema, lemario: estado.lemario, ia: crearIaSimulada({ lemario: estado.lemario, rng }), rng,
    config: estado.ajustes.generador,
  });
  estado.camino = [];
  estado.ocupado = false;
  estado.arrastre = null;
  estado.ayuda.seleccionada = null;
  estado.pista = null;
  if (estado.partida.estado === 'derrota') mostrarMensaje('El lemario no permite formar ninguna palabra en el tablero inicial.', 'derrota');
  else mostrarMensaje('');
  render();
}

// Lemario de una partida con esa etiqueta ('' = General o Supervivencia), según el modo de carga.
function lemarioActivo(etiqueta) {
  const carga = estado.ajustes.cargaTematicas;
  const clave = carga === 'juntas' ? '*' : `${carga}:${etiqueta}`;
  if (!estado.lemariosPorEtiqueta.has(clave)) {
    estado.lemariosPorEtiqueta.set(clave, lemarioDePartida({
      general: estado.lemarioGeneral, completo: estado.lemarioCompleto, etiqueta, carga,
    }));
  }
  return estado.lemariosPorEtiqueta.get(clave);
}

// Rehace los lemarios: el general (propio o por defecto) y el completo, con todas las temáticas.
function reconstruirLemario() {
  const f = estado.fuentes;
  const general = cargarLemario(f.propio ? f.propio.texto : f.porDefecto);
  if (general.palabras.length === 0) throw new Error('el lemario no tiene palabras válidas');
  const tematicas = [...f.tematicasIncluidas, ...f.tematicasPropias.map((t) => t.texto)];
  estado.lemarioGeneral = general;
  estado.lemarioCompleto = cargarLemario([f.propio ? f.propio.texto : f.porDefecto, ...tematicas].join('\n'));
  estado.lemariosPorEtiqueta.clear();
  estado.lemario = lemarioActivo(el.modo.value === 'misiones' ? estado.ajustes.tematica : '');
  renderTematicas();
}

// Temas disponibles: los incluidos más los estilos propios (un estilo propio sustituye al incluido).
function reconstruirTemas() {
  estado.temas = { ...estado.temasIncluidos };
  for (const { json } of estado.fuentes.estilosPropios) estado.temas[claveDeTema(json)] = cargarTema(json);
}

// Opciones del selector de temática y lista de temáticas de la pantalla de ajustes.
function renderTematicas() {
  const completo = estado.lemarioCompleto;
  const etiquetas = completo.listaEtiquetas;
  const nombre = (e) => nombreTematica(estado.temas, e);
  el.tematica.replaceChildren(new Option('General', ''), ...etiquetas.map((e) => new Option(nombre(e), e)));
  el.tematica.value = etiquetas.includes(estado.ajustes.tematica) ? estado.ajustes.tematica : '';
  const filas = etiquetas.length > 0
    ? etiquetas.map((e) => `${nombre(e)}: ${contarPalabras(completo.palabrasDeEtiqueta(e).length)}, ${estiloDe(e)}`)
    : ['Ninguna: solo General.'];
  // Estilos propios sin lemario de su etiqueta: aún no se pueden elegir.
  for (const { json } of estado.fuentes.estilosPropios) {
    const e = claveDeTema(json);
    if (e !== 'general' && !etiquetas.includes(e)) filas.push(`${nombre(e)}: estilo propio, falta un lemario con la etiqueta «${e}»`);
  }
  el.tematicasLista.replaceChildren(...filas.map((texto) => Object.assign(document.createElement('li'), { textContent: texto })));
  const propias = [...estado.fuentes.tematicasPropias, ...estado.fuentes.estilosPropios];
  el.tematicasQuitar.disabled = propias.length === 0;
  el.tematicasQuitar.textContent = propias.length === 0
    ? 'Quitar las temáticas que he cargado'
    : `Quitar las temáticas que he cargado (${propias.map((t) => t.nombre).join(', ')})`;
}

function estiloDe(etiqueta) {
  if (estado.fuentes.estilosPropios.some(({ json }) => claveDeTema(json) === etiqueta)) return 'estilo propio';
  return estado.temasIncluidos[etiqueta] ? 'estilo incluido' : 'estilo general';
}

function renderLemarioEstado() {
  const { propio } = estado.fuentes;
  const total = `${contarPalabras(estado.lemarioGeneral.palabras.length)}.`;
  el.lemarioEstado.textContent = propio ? `En uso: tu lemario «${propio.nombre}». ${total}` : `En uso: el lemario por defecto. ${total}`;
  el.lemarioDefecto.disabled = !propio;
}

// Copia los ajustes a los controles de la pantalla de ajustes.
function renderAjustes() {
  el.chkAyuda.checked = estado.ajustes.mostrarLista;
  el.chkDevelop.checked = estado.ajustes.develop;
  for (const input of el.parametros) input.value = String(leerRuta(estado.ajustes, input.dataset.ruta));
  for (const radio of el.cargaTematicas) radio.checked = radio.value === estado.ajustes.cargaTematicas;
  renderLemarioEstado();
}

function mensajeAjustes(texto, clase = '') {
  el.ajustesMensaje.textContent = texto;
  el.ajustesMensaje.className = clase;
}

// Cambia el lemario general (propio o, con null, el de por defecto) y empieza otra partida.
async function usarLemarioGeneral(propio) {
  const anterior = estado.fuentes.propio;
  estado.fuentes.propio = propio;
  try {
    reconstruirLemario();
  } catch (e) {
    estado.fuentes.propio = anterior;
    reconstruirLemario();
    throw e;
  }
  await nuevaPartida();
  renderLemarioEstado();
}

async function leerArchivoLemario(archivo) {
  const texto = await archivo.text();
  return { nombre: archivo.name, texto, lemario: cargarLemario(texto) };
}

async function cargarJson(ruta, tipo) {
  const r = await fetch(ruta);
  if (!r.ok) throw new Error(`${ruta}: HTTP ${r.status}`);
  return tipo === 'texto' ? r.text() : r.json();
}

async function alCargarLemarioPropio() {
  const f = el.archivo.files[0];
  el.archivo.value = '';
  if (!f) return;
  try {
    const { nombre, texto, lemario } = await leerArchivoLemario(f);
    if (lemario.palabras.length === 0) throw new Error('no tiene palabras válidas');
    await usarLemarioGeneral({ nombre, texto });
    const guardado = await guardar(GUARDADO_LEMARIO, { nombre, texto });
    const avisos = avisosLemario(estado.partida && estado.partida.tema, estado.lemario);
    if (!guardado) avisos.unshift('no se ha podido guardar en este dispositivo.');
    mensajeAjustes(
      `Lemario cargado: ${contarPalabras(lemario.palabras.length)}. Partida nueva empezada.${avisos.map((a) => ` Aviso: ${a}`).join('')}`,
      avisos.length > 0 ? 'derrota' : '',
    );
  } catch (e) {
    mensajeAjustes(`Lemario no válido: ${e.message}`, 'derrota');
  }
}

// Lee un estilo de temática (.json con nombre, paleta, eventos y retos, como data/temas/).
async function leerArchivoEstilo(archivo) {
  let json;
  try {
    json = JSON.parse(await archivo.text());
  } catch {
    throw new Error('no es un JSON válido');
  }
  cargarTema(json); // valida; lanza un error que nombra el campo que falla
  if (claveDeTema(json) === '') throw new Error('falta el nombre o la etiqueta');
  return { nombre: archivo.name, json };
}

async function alCargarTematicas() {
  const archivos = [...el.tematicasArchivo.files];
  el.tematicasArchivo.value = '';
  const lemarios = [];
  const estilos = [];
  const avisos = [];
  for (const f of archivos) {
    if (/\.json$/i.test(f.name)) {
      try {
        estilos.push(await leerArchivoEstilo(f));
      } catch (e) {
        avisos.push(`el estilo «${f.name}» no es válido: ${e.message}.`);
      }
      continue;
    }
    const { nombre, texto, lemario } = await leerArchivoLemario(f);
    if (lemario.etiquetas.size === 0) avisos.push(`«${nombre}» no tiene ninguna palabra con etiqueta (formato: palabra;etiqueta).`);
    else lemarios.push({ nombre, texto, etiquetas: lemario.listaEtiquetas });
  }
  if (lemarios.length === 0 && estilos.length === 0) {
    if (avisos.length > 0) mensajeAjustes(`No se ha cargado nada: ${avisos.join(' ')}`, 'derrota');
    return;
  }
  // Un lemario con el mismo nombre de archivo, o un estilo de la misma etiqueta, sustituye al anterior.
  const f = estado.fuentes;
  f.tematicasPropias = [
    ...f.tematicasPropias.filter((t) => !lemarios.some((n) => n.nombre === t.nombre)),
    ...lemarios.map(({ nombre, texto }) => ({ nombre, texto })),
  ];
  f.estilosPropios = [
    ...f.estilosPropios.filter((t) => !estilos.some((n) => claveDeTema(n.json) === claveDeTema(t.json))),
    ...estilos,
  ];
  reconstruirTemas();
  reconstruirLemario();
  renderLemarioEstado();
  const guardados = await Promise.all([guardar(GUARDADO_TEMATICAS, f.tematicasPropias), guardar(GUARDADO_ESTILOS, f.estilosPropios)]);
  if (guardados.includes(false)) avisos.unshift('no se han podido guardar en este dispositivo.');
  const etiquetas = new Set([...lemarios.flatMap((n) => n.etiquetas), ...estilos.map((n) => claveDeTema(n.json))]);
  const listas = [...etiquetas].filter((e) => estado.lemarioCompleto.listaEtiquetas.includes(e));
  const sinLemario = [...etiquetas].filter((e) => !listas.includes(e) && e !== 'general');
  const partes = [];
  if (listas.length > 0) partes.push(`Ya puedes elegir en «Temática» (modo Misiones): ${listas.map((e) => nombreTematica(estado.temas, e)).join(', ')}.`);
  if (sinLemario.length > 0) partes.push(`Falta un lemario con la etiqueta ${sinLemario.map((e) => `«${e}»`).join(', ')} para poder elegirla.`);
  mensajeAjustes(`${partes.join(' ')}${avisos.map((a) => ` Aviso: ${a}`).join('')}`, avisos.length > 0 ? 'derrota' : '');
  // Si se cambió el estilo o las palabras de la temática en juego, la partida empieza de nuevo.
  if (el.modo.value === 'misiones' && etiquetas.has(el.tematica.value)) await nuevaPartida();
}

async function alQuitarTematicas() {
  estado.fuentes.tematicasPropias = [];
  estado.fuentes.estilosPropios = [];
  reconstruirTemas();
  reconstruirLemario();
  renderLemarioEstado();
  await Promise.all([borrarGuardado(GUARDADO_TEMATICAS), borrarGuardado(GUARDADO_ESTILOS)]);
  if (el.modo.value === 'misiones') await nuevaPartida();
  mensajeAjustes('Quitadas las temáticas que habías cargado; quedan las incluidas en el juego.');
}

function conectarAjustes() {
  el.abrirAjustes.addEventListener('click', () => {
    renderAjustes();
    mensajeAjustes('');
    el.ajustes.showModal();
  });
  // Cierre explícito: no depende de enviar el formulario, que la validación del navegador puede bloquear.
  el.cerrarAjustes.addEventListener('click', () => el.ajustes.close());
  el.chkAyuda.addEventListener('change', () => {
    estado.ajustes = { ...estado.ajustes, mostrarLista: el.chkAyuda.checked };
    estado.ayuda.panel = el.chkAyuda.checked;
    guardarAjustesActuales();
    escanear();
    renderAyuda();
  });
  el.chkDevelop.addEventListener('change', () => {
    estado.ajustes = { ...estado.ajustes, develop: el.chkDevelop.checked };
    estado.ayuda.develop = el.chkDevelop.checked;
    guardarAjustesActuales();
    renderMarca();
  });
  for (const input of el.parametros) {
    input.addEventListener('change', () => {
      const valor = input.type === 'number' ? Number(input.value) : input.value;
      estado.ajustes = conRuta(estado.ajustes, input.dataset.ruta, valor);
      guardarAjustesActuales();
      renderAjustes(); // muestra el valor ya normalizado
      mensajeAjustes('Se aplicará en la próxima partida.');
    });
  }
  el.parametrosDefecto.addEventListener('click', () => {
    const { modo, tematica, cargaTematicas, mostrarLista, develop } = estado.ajustes;
    estado.ajustes = normalizarAjustes({ modo, tematica, cargaTematicas, mostrarLista, develop });
    guardarAjustesActuales();
    renderAjustes();
    mensajeAjustes('Valores por defecto restaurados. Se aplicarán en la próxima partida.');
  });
  el.archivo.addEventListener('change', alCargarLemarioPropio);
  el.lemarioDefecto.addEventListener('click', async () => {
    await usarLemarioGeneral(null);
    await borrarGuardado(GUARDADO_LEMARIO);
    mensajeAjustes('Vuelves a usar el lemario por defecto. Partida nueva empezada.');
  });
  el.tematicasArchivo.addEventListener('change', alCargarTematicas);
  for (const radio of el.cargaTematicas) {
    radio.addEventListener('change', async () => {
      if (!radio.checked) return;
      estado.ajustes = { ...estado.ajustes, cargaTematicas: radio.value };
      guardarAjustesActuales();
      await nuevaPartida();
      mensajeAjustes(`${MENSAJES_CARGA[radio.value]} Partida nueva empezada.`);
    });
  }
  el.tematicasQuitar.addEventListener('click', alQuitarTematicas);
}

function conectarEventos() {
  el.svg.addEventListener('pointerdown', alPulsar);
  el.svg.addEventListener('pointermove', alMover);
  document.addEventListener('pointerup', alSoltar);
  document.addEventListener('pointercancel', () => { estado.arrastre = null; });
  el.enviar.addEventListener('click', enviar);
  el.pedirAyuda.addEventListener('click', pedirAyuda);
  el.borrar.addEventListener('click', () => { if (estado.partida && !estado.ocupado) cambiarCamino([]); });
  el.nueva.addEventListener('click', nuevaPartida);
  el.modo.addEventListener('change', () => {
    estado.ajustes = { ...estado.ajustes, modo: el.modo.value };
    guardarAjustesActuales();
    nuevaPartida();
  });
  el.tematica.addEventListener('change', () => {
    estado.ajustes = { ...estado.ajustes, tematica: el.tematica.value };
    guardarAjustesActuales();
    nuevaPartida();
  });
  conectarAjustes();
}

async function iniciar() {
  conectarEventos();
  el.modo.value = estado.ajustes.modo;
  estado.ayuda.panel = estado.ajustes.mostrarLista;
  estado.ayuda.develop = estado.ajustes.develop;
  try {
    const [texto, ...resto] = await Promise.all([
      cargarJson('data/lemario.txt', 'texto'),
      ...TEMATICAS.map((t) => cargarJson(`data/tematicas/${t}.txt`, 'texto')),
      ...TEMAS.map((t) => cargarJson(`data/temas/${t}.json`, 'json')),
    ]);
    estado.fuentes.porDefecto = texto;
    estado.fuentes.tematicasIncluidas = resto.slice(0, TEMATICAS.length);
    TEMAS.forEach((t, i) => { estado.temasIncluidos[t] = cargarTema(resto[TEMATICAS.length + i]); });
  } catch (e) {
    mostrarMensaje(`No se pudieron cargar los datos: ${e.message}. Sirve la carpeta por http (ver README).`, 'derrota');
    return;
  }
  // Lo guardado en el dispositivo: lemario propio, temáticas y estilos cargados.
  const [propio, tematicas, estilos] = await Promise.all([
    leerGuardado(GUARDADO_LEMARIO), leerGuardado(GUARDADO_TEMATICAS), leerGuardado(GUARDADO_ESTILOS),
  ]);
  if (propio && typeof propio.texto === 'string') estado.fuentes.propio = propio;
  if (Array.isArray(tematicas)) estado.fuentes.tematicasPropias = tematicas.filter((t) => t && typeof t.texto === 'string');
  if (Array.isArray(estilos)) {
    estado.fuentes.estilosPropios = estilos.filter((t) => {
      try {
        return claveDeTema(cargarTema(t.json)) !== '';
      } catch {
        return false; // un estilo guardado dañado se ignora
      }
    });
  }
  reconstruirTemas();
  try {
    reconstruirLemario();
  } catch {
    estado.fuentes.propio = null; // un lemario guardado dañado no debe impedir jugar
    reconstruirLemario();
  }
  await nuevaPartida();
}

// Instalable y sin conexión: registra el service worker (solo funciona por http(s), no con file://).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker no registrado:', e));
}

iniciar();
