import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tablero, tableroDesde } from '../src/tablero.js';
import { sembrarTablero } from '../src/siembra.js';
import { clave, vecinos } from '../src/hex.js';
import { crearRng } from '../src/rng.js';
import { cargarLemario } from '../src/lemario.js';
import { FRECUENCIAS_LETRAS, GENERADOR } from '../src/config.js';
import { eliminarCasillas, renovarLetras, marcaAleatoria, crecer } from '../src/crecimiento.js';

const lemario = cargarLemario('casa\nperro\ngato\nmesa\nsol\n');

function tableroBase() {
  return sembrarTablero(lemario, { ...GENERADOR, radioInicial: 1 }, crearRng(1));
}

test('eliminarCasillas quita, registra huecos, cuenta e ignora desconocidas', () => {
  const t = tableroBase();
  const n = eliminarCasillas(t, ['0,0', '1,0', '9,9']);
  assert.equal(n, 2);
  assert.equal(t.casillas.size, 5);
  assert.ok(t.huecos.has('0,0') && t.huecos.has('1,0'));
  assert.ok(!t.huecos.has('9,9'));
});

test('crecer rellenar: ocupa huecos y luego crece fuera', () => {
  const t = tableroBase();
  eliminarCasillas(t, ['0,0', '1,0']);
  const antes = t.casillas.size;
  const res = crecer(t, 3, 'rellenar', lemario, crearRng(2));
  assert.equal(res.anadidas, 3);
  assert.equal(res.rellenadas, 2);
  assert.equal(t.huecos.size, 0);
  assert.equal(t.casillas.size, antes + 3);
});

test('crecer rellenar sin huecos', () => {
  const t = tableroBase();
  const res = crecer(t, 2, 'rellenar', lemario, crearRng(3));
  assert.equal(res.anadidas, 2);
  assert.equal(res.rellenadas, 0);
  assert.equal(t.casillas.size, 9);
});

test('crecer fuera: no toca huecos y cada nueva es adyacente a una existente', () => {
  const t = tableroBase();
  eliminarCasillas(t, ['0,0', '1,0']);
  const previas = new Set(t.casillas.keys());
  const res = crecer(t, 4, 'fuera', lemario, crearRng(4));
  assert.equal(res.rellenadas, 0);
  assert.equal(res.anadidas, 4);
  assert.ok(t.huecos.has('0,0') && t.huecos.has('1,0'));
  const orden = [...t.casillas.keys()].filter((k) => !previas.has(k));
  const vistas = new Set(previas);
  for (const k of orden) {
    const [q, r] = k.split(',').map(Number);
    assert.ok(vecinos(q, r).some((v) => vistas.has(clave(v.q, v.r))), k);
    vistas.add(k);
  }
});

test('crecer mixto: ceil(cantidad/2) en huecos', () => {
  const t = tableroBase();
  eliminarCasillas(t, ['0,0', '1,0', '-1,0', '0,1', '0,-1']);
  const res = crecer(t, 4, 'mixto', lemario, crearRng(5));
  assert.equal(res.anadidas, 4);
  assert.equal(res.rellenadas, 2);
  assert.equal(t.huecos.size, 3);
});

test('crecer en tablero vacío devuelve ceros', () => {
  const t = new Tablero();
  assert.deepEqual(crecer(t, 3, 'rellenar', lemario, crearRng(6)), { anadidas: 0, rellenadas: 0 });
});

test('renovarLetras cambia solo las del camino, siempre a otra letra', () => {
  for (let semilla = 1; semilla <= 30; semilla++) {
    const t = tableroDesde([
      { q: 0, r: 0, letra: 'a' }, { q: 1, r: 0, letra: 'b' }, { q: 0, r: 1, letra: 'c' },
    ]);
    t.casilla(0, 0).especial = { tipo: 'eliminar' };
    const A = { q: 0, r: 0 };
    const B = { q: 1, r: 0 };
    renovarLetras(t, [A, B, A], lemario, crearRng(semilla));
    assert.notEqual(t.casilla(0, 0).letra, 'a');
    assert.notEqual(t.casilla(1, 0).letra, 'b');
    assert.ok(t.casilla(0, 0).letra in FRECUENCIAS_LETRAS);
    assert.ok(t.casilla(1, 0).letra in FRECUENCIAS_LETRAS);
    assert.equal(t.casilla(0, 1).letra, 'c');
  }
});

test('marcaAleatoria devuelve marcas válidas', () => {
  const rng = crearRng(7);
  const vistos = new Set();
  for (let i = 0; i < 100; i++) {
    const m = marcaAleatoria(rng);
    if (m.tipo === 'eliminar') vistos.add('eliminar');
    else {
      assert.equal(m.tipo, 'modo');
      assert.ok(['rellenar', 'fuera', 'mixto'].includes(m.modo));
      vistos.add(m.modo);
    }
  }
  assert.equal(vistos.size, 4);
});

// Generador de prueba: registra las llamadas y devuelve siempre la misma letra.
function generadorFalso(letra) {
  const llamadas = [];
  return {
    llamadas,
    elegirLetras(tablero, posiciones, lem, config, rng) {
      llamadas.push(posiciones.map((p) => clave(p.q, p.r)));
      return new Map(posiciones.map((p) => [clave(p.q, p.r), letra]));
    },
  };
}

test('renovarLetras con generador: una sola llamada, solo las del camino, distinta de la anterior', () => {
  const t = tableroDesde([
    { q: 0, r: 0, letra: 'q' }, { q: 1, r: 0, letra: 'b' }, { q: 0, r: 1, letra: 'c' },
  ]);
  const generador = generadorFalso('q');
  const A = { q: 0, r: 0 };
  const B = { q: 1, r: 0 };
  renovarLetras(t, [A, B, A], lemario, crearRng(1), { generador });
  assert.equal(generador.llamadas.length, 1);
  assert.deepEqual([...generador.llamadas[0]].sort(), ['0,0', '1,0']);
  assert.notEqual(t.casilla(0, 0).letra, 'q');
  assert.ok(t.casilla(0, 0).letra in FRECUENCIAS_LETRAS);
  assert.equal(t.casilla(1, 0).letra, 'q');
  assert.equal(t.casilla(0, 1).letra, 'c');
});

test('crecer con generador: elegirLetras una vez con exactamente las posiciones nuevas', () => {
  for (const [modo, huecos, esperado] of [
    ['rellenar', ['0,0', '1,0'], { anadidas: 3, rellenadas: 2 }],
    ['fuera', ['0,0', '1,0'], { anadidas: 3, rellenadas: 0 }],
    ['mixto', ['0,0', '1,0', '-1,0', '0,1'], { anadidas: 3, rellenadas: 2 }],
  ]) {
    const t = tableroBase();
    eliminarCasillas(t, huecos);
    const previas = new Set(t.casillas.keys());
    const generador = generadorFalso('x');
    const res = crecer(t, 3, modo, lemario, crearRng(2), { generador });
    assert.deepEqual(res, esperado, modo);
    assert.equal(generador.llamadas.length, 1, modo);
    const nuevas = [...t.casillas.keys()].filter((k) => !previas.has(k));
    assert.deepEqual([...generador.llamadas[0]].sort(), nuevas.sort(), modo);
    for (const k of nuevas) assert.equal(t.casillas.get(k).letra, 'x');
  }
});

test('crecer: un generador que devuelve un Map incompleto no deja letras indefinidas', () => {
  const t = tableroBase();
  const generador = { elegirLetras: () => new Map() };
  crecer(t, 3, 'fuera', lemario, crearRng(2), { generador });
  for (const c of t.casillas.values()) assert.equal(typeof c.letra, 'string');
  for (const c of t.casillas.values()) assert.notEqual(c.letra, '');
});
