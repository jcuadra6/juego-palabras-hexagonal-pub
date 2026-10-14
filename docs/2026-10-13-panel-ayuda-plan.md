# Panel de ayuda y modo develop: plan de implementación

> **Para quien ejecute el plan:** SUB-HABILIDAD OBLIGATORIA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar el plan tarea por tarea. Los pasos usan casillas `- [ ]` para el seguimiento.

**Objetivo:** añadir un escáner de palabras posibles, un panel lateral que las lista y un modo develop que dibuja en el tablero el camino de la palabra seleccionada.

**Arquitectura:** `escaner.js` es una función pura (tablero y lemario entran, lista ordenada sale) que la interfaz llama solo con el panel encendido. Las decisiones de interfaz que no necesitan navegador (numerar un camino, alternar y reconciliar la selección, puntos de la línea) son funciones puras de `ui.js`. `main.js` solo conecta el estado con el DOM, y el dibujo de la marca vive en una capa aparte del SVG.

**Tecnología:** JavaScript con módulos ES, `node --test`, sin dependencias. Rama de trabajo: `feature/ayuda` (a partir de `feature/generador`).

**Especificación:** `docs/2026-10-13-panel-ayuda-design.md` (amplía `docs/2026-10-07-juego-palabras-hexagonal-design.md` y `docs/2026-10-11-generador-tableros-design.md`).

## Restricciones globales

- Sin servidor, sin claves de API, sin dependencias de runtime ni nuevas dependencias en `package.json`.
- Bloque `AYUDA` en `src/config.js`: `maxPalabras: 100`, `maxNodos: 200000`. Los valores no numéricos, menores que 1 o no finitos usan los de por defecto; los decimales se truncan.
- Panel de ayuda y modo develop: ambos apagados por defecto y sin recordarse entre sesiones.
- Con el panel apagado no se escanea nada.
- Reglas de un camino: casillas vecinas, nunca la misma casilla dos pasos seguidos, repetir casillas permitido, al menos `LONGITUD_MINIMA` (3) letras.
- Puntuación de una palabra: `camino.length * camino.length`.
- Orden de la lista: puntuación descendente y, a igualdad, orden alfabético por comparación de cadenas (`<`), sin localización.
- Solo se marca en el tablero la palabra seleccionada, y solo con el modo develop encendido. No hay tinte por intensidad.
- Todo el código, los comentarios, los mensajes y los textos de la interfaz van en español, como el resto del repositorio.
- Los 148 tests existentes siguen pasando al final de cada tarea.
- Cada mensaje de commit termina, tras una línea en blanco, con estas dos líneas:
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_018hVcgRgSG3xkUBiegkh2Ke`

## Revisión: casos que la especificación implica y que ningún test de tarea cubriría solo

Cada línea tiene su test o su comprobación en la tarea indicada.

1. Un tablero con más palabras posibles que `maxPalabras`, o con un lemario enorme, termina rápido y devuelve como mucho `maxPalabras` palabras con `truncado: true` (Task 2).
2. Cada camino de la lista es jugable de verdad: pasa `caminoValido` y forma exactamente la palabra mostrada (Task 2).
3. Una palabra con `ñ` se encuentra y se muestra bien en mayúsculas (Task 2).
4. Tras una jugada o un evento, una palabra seleccionada que ya no existe se deselecciona y su marca se borra; en misiones, un reinicio de tablero limpia la selección (Tasks 3, 4 y 5).
5. Un redibujado completo del tablero (que borra el SVG) no hace desaparecer una marca vigente, y apagar el panel o el modo develop la quita (Tasks 4 y 5).

---

### Task 1: Configuración del escáner

**Archivos:**
- Modificar: `src/config.js`
- Test: `test/config.test.js` (añadir)

**Interfaces:**
- Produce: `AYUDA = { maxPalabras: 100, maxNodos: 200000 }` y `normalizarAyuda(config?: object): { maxPalabras: number, maxNodos: number }`. Devuelve un objeto nuevo (no muta la entrada ni `AYUDA`). Cada campo ausente, no numérico, no finito o menor que 1 tras truncar pasa a su valor de `AYUDA`. `normalizarAyuda(null)` y `normalizarAyuda(5)` devuelven los valores por defecto.

- [ ] **Paso 1: escribir los tests que fallan.** `normalizarAyuda()` es igual a `AYUDA` (`deepStrictEqual`); `({ maxPalabras: 0 }).maxPalabras === 100`; `({ maxPalabras: 2.7 }).maxPalabras === 2`; `({ maxPalabras: -5 }).maxPalabras === 100`; `({ maxNodos: 'x' }).maxNodos === 200000`; `({ maxNodos: Infinity }).maxNodos === 200000`; `({ maxNodos: 50 }).maxNodos === 50`; `normalizarAyuda(null)` y `normalizarAyuda(5)` no lanzan y devuelven los valores por defecto; tras todas las llamadas `AYUDA` sigue siendo `{ maxPalabras: 100, maxNodos: 200000 }`.
- [ ] **Paso 2: ejecutar** `node --test test/config.test.js`; esperado: FALLA.
- [ ] **Paso 3: implementar** `AYUDA` y `normalizarAyuda` en `src/config.js`, conservando todo lo existente.
- [ ] **Paso 4: ejecutar** `node --test test/config.test.js`; esperado: PASA.
- [ ] **Paso 5: commit** `git add . && git commit -m "feat: configuración del escáner de palabras posibles"` (más las dos líneas finales).

---

### Task 2: Escáner de palabras posibles

**Archivos:**
- Crear: `src/escaner.js`
- Test: `test/escaner.test.js`

**Interfaces:**
- Consume: `vecinos`, `clave` de `hex.js`; `LONGITUD_MINIMA`, `AYUDA`, `normalizarAyuda` de `config.js`; `Tablero` (`casillas`, `turno`) y el criterio de casilla congelada (`congeladaHasta > tablero.turno`); `Lemario.esPrefijo`, `Lemario.existe`, `Lemario.longitudMaxima`.
- Produce:
  - Tipo `PalabraPosible = { palabra: string, camino: {q: number, r: number}[], puntos: number }`.
  - `escanearPalabras(tablero: Tablero, lemario: Lemario, opciones?: { excluir?: Set<string>, maxPalabras?: number, maxNodos?: number }): { palabras: PalabraPosible[], truncado: boolean }`.
- Comportamiento:
  - Casillas utilizables: las no congeladas. Las ocultas se usan con su letra real.
  - Recorrido en profundidad desde cada casilla utilizable, ordenadas por `q` y luego `r`. De cada casilla se va a sus vecinas utilizables, en el orden de `vecinos`. La búsqueda se poda con `lemario.esPrefijo`, se detiene al alcanzar `lemario.longitudMaxima` y se registra una palabra cuando el texto tiene al menos `LONGITUD_MINIMA` letras, `lemario.existe(texto)` y no está en `excluir`.
  - Cada palabra aparece una sola vez. Si se encuentra por varios caminos, se conserva el primero, salvo que ese repita casillas y aparezca después uno sin repeticiones, que lo reemplaza.
  - Cada nodo expandido cuenta contra `maxNodos`. Al superarlo se aborta la búsqueda y `truncado` es `true`.
  - Se ordena (puntuación descendente, luego alfabético) y se conservan las `maxPalabras` primeras. Si había más, `truncado` es `true`.
  - `opciones.maxPalabras` y `opciones.maxNodos` pasan por `normalizarAyuda`. `excluir` por defecto es un `Set` vacío. No se modifica el tablero ni el lemario. Las copias de `camino` son objetos nuevos `{ q, r }`.

- [ ] **Paso 1: escribir los tests que fallan** (con `tableroDesde`, `cargarLemario`, `normalizarAyuda` y, donde se indica, `lemarioSintetico` de `test/helpers.js`).
  - Básico: tablero `a` en `(0,0)` y `l` en `(1,0)`, lemario `['ala']`: resultado `[{ palabra: 'ala', camino: [{q:0,r:0},{q:1,r:0},{q:0,r:0}], puntos: 9 }]` y `truncado: false`.
  - Orden: tablero `s(0,0)`, `o(1,0)`, `l(2,0)`, `a(2,-1)` y lemario `['sol','sola','ola']`: el orden de `palabra` es `['sola', 'ola', 'sol']` con puntos `[16, 9, 9]`.
  - Una vez y sin repetición preferida: tablero `a(0,0)`, `b(1,0)`, `a(0,1)` y lemario `['aba']`: una sola entrada `aba` y su camino tiene 3 claves distintas.
  - `excluir: new Set(['ala'])` con el caso básico devuelve `[]`.
  - Congeladas: con `l.congeladaHasta = tablero.turno + 2` el caso básico devuelve `[]`.
  - Ocultas: con `a.ocultaHasta = tablero.turno + 2` el caso básico sigue devolviendo `ala`.
  - Caso 3 de la revisión: tablero `a(0,0)`, `ñ(1,0)`, `o(2,0)` y lemario `['año']`: se devuelve `año`.
  - Límite de palabras (caso 1 de la revisión): tablero `a(0,0)`, `b(1,0)`, lemario `['aba','bab','abab','baba','ababa','babab']` y `maxPalabras: 3`: devuelve 3 palabras (`ababa`, `babab`, `abab`) y `truncado: true`.
  - Límite de nodos: con el mismo tablero y `maxNodos: 1` no lanza, devuelve `[]` y `truncado: true`.
  - Opciones inválidas: `maxPalabras: 0` y `maxNodos: 'x'` usan los valores por defecto (devuelve las palabras con el caso básico).
  - Casos vacíos: lemario vacío (`cargarLemario('')`), tablero sin casillas, tablero de una casilla y tablero con todas las casillas congeladas devuelven `{ palabras: [], truncado: false }` sin lanzar.
  - Determinismo: dos llamadas sobre el mismo tablero dan resultados `deepStrictEqual`.
  - No muta: letras, número de casillas y `turno` iguales antes y después.
  - Caso 2 de la revisión: sobre `sembrarTablero(lemario, normalizarConfig({ radioInicial: 2 }), crearRng(11))` con `lemarioSintetico(1500, crearRng(2))`, cada elemento cumple `caminoValido(tablero, camino).valido`, `palabraDeCamino(tablero, camino) === palabra` y `puntos === camino.length ** 2`, y la lista no está vacía.
  - Caso 1 de la revisión (rendimiento): sobre `sembrarTablero(lemarioSintetico(5000, crearRng(5)), normalizarConfig({ radioInicial: 5 }), crearRng(6))`, el escaneo con las opciones por defecto termina en menos de 2000 ms, devuelve como mucho 100 palabras y están ordenadas por puntuación descendente.
- [ ] **Paso 2: ejecutar** `node --test test/escaner.test.js`; esperado: FALLA.
- [ ] **Paso 3: implementar** `escanearPalabras` en `src/escaner.js`.
- [ ] **Paso 4: ejecutar** `npm test`; esperado: PASA (los 148 anteriores más los nuevos).
- [ ] **Paso 5: commit** `feat: escáner de palabras posibles del tablero` (más las dos líneas finales).

---

### Task 3: Funciones puras de la interfaz

**Archivos:**
- Modificar: `src/ui.js`
- Test: `test/ui.test.js` (añadir)

**Interfaces:**
- Consume: `aPixel`, `clave` de `hex.js` y el formato de `puntosDeHexagono` ya presente en `ui.js`.
- Produce, exportadas desde `src/ui.js`, sin tocar `document` ni `window` al importar:
  - `numerarCamino(camino: {q, r}[]): Map<string, number[]>`: clave `"q,r"` a los números de orden, empezando en 1, en el orden de paso.
  - `alternarSeleccion(seleccionada: string | null, palabra: string): string | null`: devuelve `null` si `palabra === seleccionada` y `palabra` en otro caso.
  - `reconciliarSeleccion(seleccionada: string | null, palabras: { palabra: string }[]): string | null`: devuelve `seleccionada` si es no nula y alguna de `palabras` la tiene como `palabra`; `null` en otro caso.
  - `puntosDeCamino(camino: {q, r}[], tamano: number): string`: pares `x,y` separados por espacio con tres decimales (`toFixed(3)`), uno por casilla del camino, con `aPixel`; `''` si el camino está vacío.
  - `dibujarMarca(svg: SVGElement, camino: {q, r}[], tamano: number): void`: borra el grupo `g.marca` previo si existe y, si `camino` no está vacío, añade al final del SVG un `<g class="marca" pointer-events="none">` con una `polyline` (`class="marca-linea"`, `fill="none"`, `points = puntosDeCamino(...)`) y un `<text class="marca-numero">` por casilla con los números de `numerarCamino` unidos por coma, centrado en la casilla.
  - `borrarMarca(svg: SVGElement): void`: quita el grupo `g.marca` si existe.

- [ ] **Paso 1: escribir los tests que fallan.**
  - `numerarCamino([{q:0,r:0},{q:1,r:0},{q:0,r:0}])`: la clave `'0,0'` vale `[1, 3]`, `'1,0'` vale `[2]`, y el mapa tiene 2 claves; `numerarCamino([])` está vacío.
  - `alternarSeleccion(null, 'sol') === 'sol'`; `alternarSeleccion('sol', 'sol') === null`; `alternarSeleccion('sol', 'ola') === 'ola'`.
  - `reconciliarSeleccion('sol', [{palabra:'sol'},{palabra:'ola'}]) === 'sol'`; `reconciliarSeleccion('sol', [{palabra:'ola'}]) === null`; `reconciliarSeleccion(null, [{palabra:'sol'}]) === null`; `reconciliarSeleccion('sol', []) === null`.
  - `puntosDeCamino([{q:0,r:0},{q:1,r:0}], 10)` es `'0.000,0.000 17.321,0.000'`; `puntosDeCamino([], 10) === ''`.
- [ ] **Paso 2: ejecutar** `node --test test/ui.test.js`; esperado: FALLA.
- [ ] **Paso 3: implementar** las funciones en `src/ui.js`. `dibujarMarca` y `borrarMarca` se escriben con las mismas ayudas del archivo (`crear` y `SVG_NS`) y no tienen test unitario: se verifican en la Task 4.
- [ ] **Paso 4: ejecutar** `npm test`; esperado: PASA.
- [ ] **Paso 5: commit** `feat: funciones puras y capa de marca del panel de ayuda` (más las dos líneas finales).

---

### Task 4: Panel lateral, interruptores y marca en el tablero

**Archivos:**
- Modificar: `index.html`, `styles.css`, `src/main.js`

**Interfaces:**
- Consume: `escanearPalabras` (Task 2), `AYUDA` (Task 1) y `numerarCamino`, `alternarSeleccion`, `reconciliarSeleccion`, `dibujarMarca`, `borrarMarca` (Task 3). Del código existente: `estado`, `render`, `nuevaPartida`, `enviar`, `TAMANO`, `el`.
- Produce: la interfaz de la sección 4 de la especificación. Sin API nueva.
- Estructura de `index.html`:
  - Un contenedor `<div class="pagina">` que envuelve el `<main>` actual y un `<aside id="panel-ayuda" hidden>` con `<h2 id="ayuda-titulo">`, `<p id="ayuda-aviso" hidden>` ("La lista puede estar incompleta.") y `<ul id="ayuda-lista">`.
  - En `.controles`, dos `<label class="interruptor">` con `<input type="checkbox" id="chk-ayuda">` ("Panel de ayuda") y `<input type="checkbox" id="chk-develop">` ("Modo develop").
- Estado nuevo en `main.js`: `estado.ayuda = { panel: false, develop: false, palabras: [], truncado: false, seleccionada: null }`.
- Comportamiento:
  - `escanear()`: si `!panel` o no hay partida, vacía `palabras`, `truncado` y `seleccionada`; si no, llama a `escanearPalabras(partida.tablero, estado.lemario, { excluir: partida.palabrasUsadas })`, guarda `palabras` y `truncado` y aplica `reconciliarSeleccion` a `seleccionada`.
  - `renderAyuda()`: muestra u oculta el aside (y añade `con-ayuda` a `.pagina` solo si el panel está encendido), escribe "Palabras posibles (N)" con N igual a `palabras.length`, muestra el aviso solo si `truncado`, y dibuja un `<button type="button">` por palabra, en mayúsculas más su puntuación, con `aria-pressed` verdadero en la seleccionada. Después llama a `renderMarca()`.
  - `renderMarca()`: si `panel && develop && seleccionada`, busca la palabra en `palabras` y llama a `dibujarMarca(el.svg, camino, TAMANO)`; si no, `borrarMarca(el.svg)`.
  - Pulsar un botón de la lista: `seleccionada = alternarSeleccion(seleccionada, palabra)` y `renderAyuda()`.
  - Cambiar `chk-ayuda`: guarda `panel`; si se enciende y hay partida, `escanear()`; si se apaga, vacía lista y selección; `renderAyuda()`.
  - Cambiar `chk-develop`: guarda `develop` y `renderMarca()`.
  - `render()`: tras `dibujarTablero` (que vacía el SVG), llama a `escanear()` y `renderAyuda()`, de modo que la marca se vuelve a dibujar tras cada redibujado.
  - `nuevaPartida()`: pone `seleccionada = null` antes de `render()`.
  - `enviar()`: si `res.tableroReiniciado`, pone `seleccionada = null` antes de `render()`.
- Estilos: `.pagina` es un grid centrado de una columna (`minmax(0, 760px)`); con `.con-ayuda` pasa a dos columnas (`minmax(0, 760px) 18rem`) con `gap: 1rem`; por debajo de 900 px de ancho, una sola columna y el panel debajo del tablero. La lista tiene `max-height` y `overflow-y: auto`. Estilos para `.interruptor`, los botones de la lista (incluido el estado `aria-pressed="true"`), `.marca-linea` (trazo del color de acento, sin relleno, grosor visible) y `.marca-numero` (texto pequeño centrado, `pointer-events: none`).

- [ ] **Paso 1: escribir el HTML y los estilos** de la estructura y los estilos descritos.
- [ ] **Paso 2: implementar** en `main.js` el estado, `escanear`, `renderAyuda`, `renderMarca`, los manejadores de los dos interruptores y de la lista, y los cambios de `render`, `nuevaPartida` y `enviar`. Registrar los manejadores en `conectarEventos()`, antes de la carga de datos, como el resto.
- [ ] **Paso 3: ejecutar** `npm test`; esperado: PASA (la interfaz no tiene test unitario).
- [ ] **Paso 4: comprobación rápida en el navegador.** Servir con `python3 -m http.server 8000` y abrir `http://localhost:8000`: sin errores en consola al cargar, con el panel apagado no aparece la lista, y con él encendido aparece con al menos una palabra. La verificación completa es la del paso 3 de la Task 5.
- [ ] **Paso 5: commit** `feat: panel lateral de palabras posibles y marca de la palabra seleccionada` (más las dos líneas finales).

---

### Task 5: Documentación y verificación en el navegador

**Archivos:**
- Modificar: `README.md`

**Interfaces:**
- Consume: todo lo anterior. No produce interfaces nuevas.

- [ ] **Paso 1: documentar en `README.md`** una sección "Panel de ayuda y modo develop": qué muestra la lista, cómo se ordena, los dos interruptores y su comportamiento (con el modo develop apagado la lista es solo texto), el bloque `AYUDA` con sus dos parámetros y valores, que la lista revela la letra real de las casillas ocultas y que puede quedar incompleta (aviso) cuando se agota el presupuesto. Enlazar la especificación.
- [ ] **Paso 2: ejecutar** `npm test`; esperado: todo en verde.
- [ ] **Paso 3: servir y verificar.** Servir con `python3 -m http.server 8000` y comprobar con Chromium sin interfaz (cliente `playwright-core` instalado fuera del repositorio, por ejemplo en un directorio temporal, con `executablePath: '/opt/pw-browsers/chromium'`; no se añade nada a `package.json`):
  - panel apagado y modo develop apagado: no hay lista visible ni marca, y el tablero se ve como antes;
  - panel encendido: aparece "Palabras posibles (N)" con N mayor que 0 y los botones aparecen ordenados por puntuación descendente;
  - con el modo develop apagado, seleccionar una palabra pone `aria-pressed="true"` pero no dibuja ninguna marca (no hay `g.marca` en el SVG);
  - con el modo develop encendido, seleccionar una palabra dibuja `g.marca` con una `polyline` y tantos números como pasos del camino; seleccionar otra reemplaza la marca; pulsar de nuevo la seleccionada la borra;
  - apagar el modo develop o el panel borra la marca;
  - formar y enviar una palabra desde el tablero actualiza la lista y deselecciona (y borra la marca de) una palabra que ya no existe;
  - en misiones, forzar un reinicio de tablero o iniciar una partida nueva limpia la selección;
  - a 600 px de ancho el panel queda debajo del tablero y a 1200 px a su derecha.
- [ ] **Paso 4: commit** `docs: README del panel de ayuda y modo develop` (más las dos líneas finales).

---

## Autorevisión

- **Cobertura de la especificación:** escáner y sus reglas, orden, exclusiones y límites (§3, Task 2); configuración `AYUDA` (§7, Task 1); panel, interruptores, marca y momentos de escaneo (§4, Task 4); funciones puras y capa del SVG (§4.5, Task 3); casos límite (§6, tests de Tasks 2 y 3 y comprobaciones de Task 5); pruebas (§8, Tasks 2, 3 y 5); documentación (§5, Task 5).
- **Consistencia de tipos:** `PalabraPosible` y `escanearPalabras` (Task 2) los consumen `reconciliarSeleccion` y el panel (Tasks 3 y 4); `numerarCamino`, `puntosDeCamino`, `dibujarMarca` y `borrarMarca` (Task 3) los usa `renderMarca` (Task 4); `normalizarAyuda` (Task 1) la usa el escáner (Task 2).
- **Decisiones que el plan añade a la especificación:** `normalizarAyuda` para tratar valores inválidos; `reconciliarSeleccion` y `puntosDeCamino` como funciones puras para poder probar la deselección y el trazo sin navegador; la clase `con-ayuda` del contenedor para que la página quede centrada cuando el panel está apagado; el escaneo ocurre dentro de `render()`, que ya se ejecuta tras cada jugada, partida nueva y reinicio; al terminar la partida (victoria o derrota) la lista se sigue calculando, sin efecto sobre el juego.
