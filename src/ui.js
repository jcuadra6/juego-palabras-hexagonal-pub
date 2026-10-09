// Capa de interfaz: ayudas puras (sin DOM) y dibujo SVG. Nada toca document/window al importar.
import { aPixel, clave, vecinos } from './hex.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MARGEN_VIEWBOX = 0.8; // en unidades de "tamano"

export const ICONOS_MODO = { rellenar: '●', fuera: '↗', mixto: '◐' };
export const ICONO_ELIMINAR = '✖';

// Atributo "points" de un hexágono de punta arriba (6 vértices a distancia "tamano").
export function puntosDeHexagono(cx, cy, tamano) {
  const pares = [];
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 180) * (60 * i - 30);
    pares.push(`${(cx + tamano * Math.cos(ang)).toFixed(3)},${(cy + tamano * Math.sin(ang)).toFixed(3)}`);
  }
  return pares.join(' ');
}

function coordenadasDeClave(k) {
  const [q, r] = k.split(',').map(Number);
  return { q, r };
}

// viewBox que abarca casillas y huecos actuales (el tablero crece, así que se recalcula).
export function calcularViewBox(tablero, tamano) {
  const celdas = [...tablero.casillas.values(), ...[...tablero.huecos].map(coordenadasDeClave)];
  if (celdas.length === 0) celdas.push({ q: 0, r: 0 });
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const { q, r } of celdas) {
    const { x, y } = aPixel(q, r, tamano);
    minX = Math.min(minX, x - tamano); maxX = Math.max(maxX, x + tamano);
    minY = Math.min(minY, y - tamano); maxY = Math.max(maxY, y + tamano);
  }
  const m = tamano * MARGEN_VIEWBOX;
  return `${minX - m} ${minY - m} ${maxX - minX + 2 * m} ${maxY - minY + 2 * m}`;
}

// Nuevo camino al pulsar/entrar en la casilla "celda". Puro: no modifica "camino".
// - Camino vacío: empieza en la casilla.
// - Misma casilla que la última: al arrastrar no hace nada; al tocar, deshace un paso.
// - Casilla vecina de la última: se añade. Otra casilla: se ignora.
export function extenderCamino(camino, celda, { arrastre = false } = {}) {
  if (camino.length === 0) return [{ q: celda.q, r: celda.r }];
  const ultima = camino[camino.length - 1];
  if (ultima.q === celda.q && ultima.r === celda.r) {
    return arrastre ? camino : camino.slice(0, -1);
  }
  const esVecina = vecinos(ultima.q, ultima.r).some((v) => v.q === celda.q && v.r === celda.r);
  return esVecina ? [...camino, { q: celda.q, r: celda.r }] : camino;
}

export const estaCongelada = (tablero, c) => c.congeladaHasta > tablero.turno;
export const estaOculta = (tablero, c) => c.ocultaHasta > tablero.turno;

export function textoPalabra(tablero, camino) {
  return camino.map((p) => {
    const c = tablero.casilla(p.q, p.r);
    if (!c) return '';
    return estaOculta(tablero, c) ? '?' : c.letra;
  }).join('');
}

function crear(nombre, atributos = {}) {
  const el = document.createElementNS(SVG_NS, nombre);
  for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, v);
  return el;
}

// Redibuja el tablero actual. Lee siempre partida.tablero (misiones lo sustituye al reiniciar).
export function dibujarTablero(svg, partida, tamano) {
  const tablero = partida.tablero;
  svg.replaceChildren();
  svg.setAttribute('viewBox', calcularViewBox(tablero, tamano));

  for (const k of tablero.huecos) {
    const { q, r } = coordenadasDeClave(k);
    const { x, y } = aPixel(q, r, tamano);
    svg.appendChild(crear('polygon', {
      class: 'hueco', points: puntosDeHexagono(x, y, tamano * 0.92), 'data-hueco': k,
    }));
  }

  for (const c of tablero.casillas.values()) {
    const { x, y } = aPixel(c.q, c.r, tamano);
    const congelada = estaCongelada(tablero, c);
    const oculta = estaOculta(tablero, c);
    const g = crear('g', { class: 'casilla' });
    const clases = ['hex'];
    if (congelada) clases.push('congelada');
    if (oculta) clases.push('oculta');
    if (c.especial) clases.push('especial');
    g.appendChild(crear('polygon', {
      class: clases.join(' '),
      points: puntosDeHexagono(x, y, tamano * 0.92),
      'data-clave': clave(c.q, c.r),
    }));
    const letra = crear('text', { class: 'letra', x, y: y + tamano * 0.1 });
    letra.textContent = oculta ? '?' : c.letra.toUpperCase();
    g.appendChild(letra);
    if (c.especial) {
      const icono = crear('text', { class: 'icono', x, y: y - tamano * 0.5 });
      icono.textContent = c.especial.tipo === 'eliminar'
        ? ICONO_ELIMINAR : (ICONOS_MODO[c.especial.modo] ?? '★');
      g.appendChild(icono);
    }
    if (congelada) {
      const hielo = crear('text', { class: 'icono hielo', x, y: y + tamano * 0.62 });
      hielo.textContent = '❄';
      g.appendChild(hielo);
    }
    svg.appendChild(g);
  }
}

// Resalta el camino sin reconstruir el SVG (así los punteros capturados siguen vivos).
export function marcarCamino(svg, camino) {
  const en = new Map();
  camino.forEach((p, i) => en.set(clave(p.q, p.r), i));
  const ultima = camino[camino.length - 1];
  for (const hex of svg.querySelectorAll('[data-clave]')) {
    const i = en.get(hex.dataset.clave);
    hex.classList.toggle('seleccionada', i !== undefined);
    hex.classList.toggle('ultima', ultima !== undefined && hex.dataset.clave === clave(ultima.q, ultima.r));
  }
}
