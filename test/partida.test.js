import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tableroDesde } from '../src/tablero.js';
import { cargarLemario } from '../src/lemario.js';
import { crearIaSimulada } from '../src/ia.js';
import { modoActivo, EVENTOS_BASE } from '../src/eventos.js';
import { cargarTema } from '../src/modos.js';
import { readFileSync } from 'node:fs';
import { crearPartida, jugarPalabra } from '../src/partida.js';

const base = cargarLemario('casa\nsol\nsal\nmal\nluz\nzzz\n');
// Lemario con letra aleatoria fija ('z'), distinta de las letras del tablero de prueba.
const lemario = Object.create(base);
lemario.letraAleatoria = () => 'z';
const rng = () => 0.5;
const ia = crearIaSimulada({ lemario, rng });

const CAM3 = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }];
const CAM4 = [...CAM3, { q: -1, r: 1 }];

function tableroPrueba() {
  return tableroDesde([
    { q: 0, r: 0, letra: 's' }, { q: 1, r: 0, letra: 'o' }, { q: 0, r: 1, letra: 'l' },
    { q: -1, r: 1, letra: 'a' }, { q: -1, r: 0, letra: 'x' }, { q: 0, r: -1, letra: 'x' },
    { q: 1, r: -1, letra: 'x' },
  ]);
}

function nueva(extra = {}) {
  const p = crearPartida({ modo: 'supervivencia', lemario, ia, rng, ...extra });
  p.tablero = tableroPrueba();
  return p;
}

function escribir(p, camino, palabra) {
  camino.forEach((c, i) => { p.tablero.casilla(c.q, c.r).letra = palabra[i]; });
}

const iaFija = (evento) => ({
  validarPalabra: (pal) => ia.validarPalabra(pal),
  siguienteEvento: async () => evento,
});
const elimina5 = { tipo: 'eliminar', alcance: { radio: 5, centro: { q: 0, r: 0 } }, duracion: 0, modoCrecimiento: null };

test('palabra de 3 letras: 9 puntos, 1 casilla nueva, camino renovado', async () => {
  const p = nueva();
  const res = await jugarPalabra(p, CAM3);
  assert.equal(res.aceptada, true);
  assert.equal(res.palabra, 'sol');
  assert.equal(res.puntos, 9);
  assert.equal(res.anadidas, 1);
  assert.equal(p.puntos, 9);
  assert.equal(p.tablero.turno, 1);
  assert.ok(p.palabrasUsadas.has('sol'));
  for (const c of CAM3) assert.equal(p.tablero.casilla(c.q, c.r).letra, 'z');
  assert.equal(p.tablero.casilla(-1, 0).letra, 'x');
  assert.equal(p.tablero.casillas.size, 8);
});

test('palabra de 4 letras: 16 puntos y 2 casillas nuevas', async () => {
  const p = nueva();
  escribir(p, CAM4, 'casa');
  const res = await jugarPalabra(p, CAM4);
  assert.equal(res.aceptada, true);
  assert.equal(res.puntos, 16);
  assert.equal(res.anadidas, 2);
});

test('palabra repetida se rechaza sin cambiar nada', async () => {
  const p = nueva();
  await jugarPalabra(p, CAM3);
  escribir(p, CAM3, 'sol');
  const puntos = p.puntos;
  const tam = p.tablero.casillas.size;
  const turno = p.tablero.turno;
  const res = await jugarPalabra(p, CAM3);
  assert.deepEqual(res, { aceptada: false, motivo: 'repetida' });
  assert.equal(p.puntos, puntos);
  assert.equal(p.tablero.casillas.size, tam);
  assert.equal(p.tablero.turno, turno);
});

test('palabra fuera del lemario o camino corto: rechazo con motivo y tablero intacto', async () => {
  const p = nueva();
  escribir(p, CAM3, 'sxl');
  const antes = JSON.stringify([...p.tablero.casillas.values()]);
  const res = await jugarPalabra(p, CAM3);
  assert.deepEqual(res, { aceptada: false, motivo: 'no-esta-en-el-lemario' });
  const corto = await jugarPalabra(p, CAM3.slice(0, 2));
  assert.deepEqual(corto, { aceptada: false, motivo: 'corto' });
  assert.equal(JSON.stringify([...p.tablero.casillas.values()]), antes);
  assert.equal(p.puntos, 0);
  assert.equal(p.tablero.turno, 0);
  assert.equal(p.palabrasUsadas.size, 0);
});

test('marca modo fuera del camino: los huecos previos se conservan', async () => {
  const conMarca = nueva();
  conMarca.tablero.casillas.delete('1,-1');
  conMarca.tablero.huecos.add('1,-1');
  conMarca.tablero.casilla(0, 0).especial = { tipo: 'modo', modo: 'fuera' };
  await jugarPalabra(conMarca, CAM3);
  assert.ok(conMarca.tablero.huecos.has('1,-1'));

  const sinMarca = nueva();
  sinMarca.tablero.casillas.delete('1,-1');
  sinMarca.tablero.huecos.add('1,-1');
  await jugarPalabra(sinMarca, CAM3);
  assert.ok(!sinMarca.tablero.huecos.has('1,-1'));
});

test('marca eliminar del camino elimina las casillas de alrededor', async () => {
  const p = nueva();
  p.tablero.casilla(-1, 0).especial = { tipo: 'eliminar' };
  const cam = [{ q: 0, r: 1 }, { q: -1, r: 1 }, { q: -1, r: 0 }];
  escribir(p, cam, 'sal');
  const res = await jugarPalabra(p, cam);
  assert.equal(res.aceptada, true);
  for (const k of ['-1,0', '0,0', '-1,1', '0,-1']) {
    assert.ok(!p.tablero.casillas.has(k), k);
    assert.ok(p.tablero.huecos.has(k), k);
  }
});

test('supervivencia: un evento que vacía el tablero da derrota y luego partida-terminada', async () => {
  const p = nueva({ ia: iaFija(elimina5), eventoCada: 1 });
  const res = await jugarPalabra(p, CAM3);
  assert.equal(res.aceptada, true);
  assert.equal(p.estado, 'derrota');
  assert.equal(p.tablero.casillas.size, 0);
  const otra = await jugarPalabra(p, CAM3);
  assert.deepEqual(otra, { aceptada: false, motivo: 'partida-terminada' });
});

const tema = (retos) => ({
  nombre: 't', paleta: {}, eventos: [], palabrasObjetivo: ['luz'], retos,
});

test('misiones: cumplir el reto de longitud da victoria', async () => {
  const p = nueva({ modo: 'misiones', tema: tema([{ tipo: 'longitud', meta: 3 }]) });
  await jugarPalabra(p, CAM3);
  assert.equal(p.estado, 'victoria');
  const otra = await jugarPalabra(p, CAM3);
  assert.equal(otra.motivo, 'partida-terminada');
});

test('misiones: tablero vaciado por un evento se reinicia a 7 casillas', async () => {
  const p = nueva({
    modo: 'misiones', tema: tema([{ tipo: 'longitud', meta: 99 }]), ia: iaFija(elimina5), eventoCada: 1,
  });
  p.eventosActivos.push({ evento: { modoCrecimiento: 'fuera' }, hastaTurno: 50 });
  await jugarPalabra(p, CAM3);
  assert.equal(p.estado, 'jugando');
  assert.equal(p.tablero.casillas.size, 7);
  assert.equal(p.eventosActivos.length, 0);
});

test('misiones: el reto regenerar recibe un número de casillas rellenadas', async () => {
  const p = nueva({ modo: 'misiones', tema: tema([{ tipo: 'regenerar', meta: 1 }]) });
  p.tablero.casillas.delete('1,-1');
  p.tablero.huecos.add('1,-1');
  await jugarPalabra(p, CAM3);
  assert.equal(p.mision.objetivos[0].progreso, 1);
  assert.equal(p.estado, 'victoria');
});

test('evento con duración: se guarda, rige el modo y caduca', async () => {
  const evento = {
    tipo: 'congelar', alcance: { radio: 0, centro: { q: 1, r: -1 } }, duracion: 2, modoCrecimiento: 'fuera',
  };
  let llamadas = 0;
  const p = nueva({
    eventoCada: 1,
    ia: { validarPalabra: (w) => ia.validarPalabra(w), siguienteEvento: async () => (llamadas++ === 0 ? evento : null) },
  });
  const res = await jugarPalabra(p, CAM3);
  assert.deepEqual(res.evento, evento);
  assert.equal(p.eventosActivos.length, 1);
  assert.equal(p.eventosActivos[0].hastaTurno, 3);
  assert.equal(modoActivo(p.eventosActivos, p.tablero.turno), 'fuera');
  escribir(p, CAM3, 'sal');
  await jugarPalabra(p, CAM3);
  assert.equal(p.eventosActivos.length, 1);
  escribir(p, CAM3, 'mal');
  await jugarPalabra(p, CAM3);
  assert.equal(p.tablero.turno, 3);
  assert.equal(p.eventosActivos.length, 0);
  assert.equal(modoActivo(p.eventosActivos, p.tablero.turno), 'rellenar');
});

const iaRota = {
  validarPalabra: (w) => ia.validarPalabra(w),
  siguienteEvento: async () => { throw new Error('IA caída'); },
};

test('siguienteEvento que falla no deja la jugada a medias (misiones)', async () => {
  const p = nueva({
    modo: 'misiones', tema: tema([{ tipo: 'longitud', meta: 3 }]), ia: iaRota, eventoCada: 1,
  });
  const res = await jugarPalabra(p, CAM3);
  assert.equal(res.aceptada, true);
  assert.equal(res.eventoError, true);
  assert.equal(res.evento, undefined);
  assert.equal(p.puntos, 9);
  assert.equal(p.tablero.turno, 1);
  assert.equal(p.estado, 'victoria');
  escribir(p, CAM3, 'sol');
  assert.equal((await jugarPalabra(p, CAM3)).motivo, 'partida-terminada');
});

test('siguienteEvento que falla: el final se evalúa tras una marca eliminar (supervivencia)', async () => {
  const p = nueva({ ia: iaRota, eventoCada: 1 });
  p.tablero.casilla(0, 0).especial = { tipo: 'eliminar' };
  // Deja solo las casillas del camino y su entorno inmediato para que la marca vacíe el tablero.
  for (const k of ['-1,0', '0,-1', '1,-1', '-1,1']) {
    p.tablero.casillas.delete(k);
    p.tablero.huecos.add(k);
  }
  const res = await jugarPalabra(p, CAM3);
  assert.equal(res.aceptada, true);
  assert.equal(res.eventoError, true);
  assert.equal(p.puntos, 9);
  assert.equal(p.tablero.turno, 1);
  assert.equal(p.estado, 'derrota');
  assert.equal(p.tablero.casillas.size, 0);
  assert.equal(p.palabrasUsadas.size, 1);
});

test('siguienteEvento que falla: repetir la palabra se rechaza como repetida', async () => {
  const p = nueva({ ia: iaRota, eventoCada: 1 });
  await jugarPalabra(p, CAM3);
  escribir(p, CAM3, 'sol');
  assert.deepEqual(await jugarPalabra(p, CAM3), { aceptada: false, motivo: 'repetida' });
  assert.equal(p.puntos, 9);
  assert.equal(p.tablero.turno, 1);
});

// Congela todo el tablero (centro 0,0 radio 5) durante 2 turnos.
const congelaTodo = { tipo: 'congelar', alcance: { radio: 5, centro: { q: 0, r: 0 } }, duracion: 2, modoCrecimiento: null };

test('supervivencia: congelar todo el tablero no es derrota y el tablero vuelve a ser jugable', async () => {
  const p = nueva({ ia: iaFija(congelaTodo), eventoCada: 1 });
  const res = await jugarPalabra(p, CAM3);
  assert.equal(res.aceptada, true);
  assert.equal(p.estado, 'jugando');
  assert.ok(p.tablero.casillas.size > 0);
  for (const c of p.tablero.casillas.values()) assert.ok(c.congeladaHasta <= p.tablero.turno);
  p.ia = iaFija(null);
  escribir(p, CAM3, 'sal');
  const otra = await jugarPalabra(p, CAM3);
  assert.equal(otra.aceptada, true);
});

test('supervivencia: sin ninguna palabra posible (ni congeladas) sigue siendo derrota', async () => {
  const p = nueva({ ia: iaFija(null), eventoCada: 1 });
  // Tras la jugada todas las letras serán 'z' y 'zzz' se usa; se vacía el lemario efectivo.
  p.lemario = cargarLemario('sol\n');
  const ventana = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }];
  escribir(p, ventana, 'sol');
  for (const k of ['-1,1', '-1,0', '0,-1', '1,-1']) p.tablero.casillas.delete(k);
  p.lemario.letraAleatoria = () => 'z';
  p.lemario.palabraAleatoria = () => null; // no se puede garantizar una palabra
  const res = await jugarPalabra(p, ventana);
  assert.equal(res.aceptada, true);
  assert.equal(p.estado, 'derrota');
});

test('misiones: reinicio por falta de palabras marca tableroReiniciado', async () => {
  const p = nueva({
    modo: 'misiones', tema: tema([{ tipo: 'longitud', meta: 99 }]), ia: iaFija(elimina5), eventoCada: 1,
  });
  const res = await jugarPalabra(p, CAM3);
  assert.equal(res.tableroReiniciado, true);
  const q = nueva({ modo: 'misiones', tema: tema([{ tipo: 'longitud', meta: 99 }]) });
  assert.equal((await jugarPalabra(q, CAM3)).tableroReiniciado, undefined);
});

test('misiones: un tablero congelado entero no se reinicia', async () => {
  const p = nueva({
    modo: 'misiones', tema: tema([{ tipo: 'longitud', meta: 99 }]), ia: iaFija(congelaTodo), eventoCada: 1,
  });
  const res = await jugarPalabra(p, CAM3);
  assert.equal(res.tableroReiniciado, undefined);
  assert.equal(p.tablero.casillas.size, 8);
});

test('evento de duración 0 con modoCrecimiento impone el modo al siguiente crecimiento', async () => {
  const eliminarFuera = EVENTOS_BASE[5];
  assert.equal(eliminarFuera.duracion, 0);
  assert.equal(eliminarFuera.modoCrecimiento, 'fuera');
  const halloween = cargarTema(JSON.parse(readFileSync(new URL('../data/temas/halloween.json', import.meta.url), 'utf8')));
  const deTema = halloween.eventos.find((e) => e.tipo === 'eliminar' && e.duracion === 0 && e.modoCrecimiento === 'fuera');
  assert.ok(deTema);
  for (const plantilla of [eliminarFuera, deTema]) {
    const evento = { ...plantilla, alcance: { radio: 0, centro: { q: -1, r: 0 } } };
    let n = 0;
    const p = nueva({
      eventoCada: 1,
      ia: { validarPalabra: (w) => ia.validarPalabra(w), siguienteEvento: async () => (n++ === 0 ? evento : null) },
    });
    await jugarPalabra(p, CAM3);
    assert.ok(p.tablero.huecos.has('-1,0'));
    assert.equal(modoActivo(p.eventosActivos, p.tablero.turno), 'fuera');
    escribir(p, CAM3, 'sal');
    await jugarPalabra(p, CAM3);
    assert.ok(p.tablero.huecos.has('-1,0'), 'el hueco se conserva: crecimiento hacia fuera');
    assert.equal(modoActivo(p.eventosActivos, p.tablero.turno), 'rellenar');
  }
});

test('jugarPalabra no es reentrante: la segunda llamada concurrente se rechaza', async () => {
  const p = nueva();
  const a = jugarPalabra(p, CAM3);
  const b = await jugarPalabra(p, CAM3);
  assert.deepEqual(b, { aceptada: false, motivo: 'ocupada' });
  const ra = await a;
  assert.equal(ra.aceptada, true);
  assert.equal(p.puntos, 9);
  assert.equal(p.tablero.turno, 1);
  escribir(p, CAM3, 'sal');
  assert.equal((await jugarPalabra(p, CAM3)).aceptada, true); // la bandera se libera
});

test('crearPartida: un tablero inicial sin palabra posible no queda en jugando', () => {
  const l = cargarLemario('ab\n'); // ninguna palabra válida
  const p = crearPartida({ modo: 'supervivencia', lemario: l, ia, rng });
  assert.equal(p.estado, 'derrota');
});
