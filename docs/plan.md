# Juego de palabras hexagonal: plan de implementación

> **Para quien ejecute el plan:** SUB-HABILIDAD OBLIGATORIA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar el plan tarea por tarea. Los pasos usan casillas `- [ ]` para el seguimiento.

**Objetivo:** construir el prototipo web local de un juego de palabras sobre tablero hexagonal que crece, pierde casillas y se regenera.

**Arquitectura:** módulos ES (JavaScript sin dependencias) con lógica pura y testeable (`hex`, `tablero`, `lemario`, `eventos`, `ia`, `modos`, `partida`) y una capa de interfaz SVG (`ui`, `main`). La IA vive detrás de una interfaz asíncrona de dos funciones, con una implementación simulada para el prototipo.

**Tecnología:** JavaScript (módulos ES), Node.js 20+ solo para los tests (`node --test`, `node:assert/strict`), sin librerías externas. Para jugar se sirve la carpeta con `python3 -m http.server 8000` (los módulos y `fetch` no funcionan desde `file://`).

**Especificación:** `2026-10-07-juego-palabras-hexagonal-design.md`

## Restricciones globales

- Sin servidor propio, sin claves de API, sin dependencias de runtime.
- Longitud mínima de palabra: 3 letras (cada paso del camino aporta una letra).
- El camino puede repetir casilla, pero no quedarse en la misma casilla dos pasos seguidos.
- Tablero inicial: casilla central `(0,0)` y su anillo de radio 1 (7 casillas).
- Casillas nuevas por palabra válida: `max(1, floor(longitud / 2))`.
- Puntuación por palabra: `longitud * longitud`.
- Una palabra no puede puntuar dos veces en la misma partida.
- Comparación con el lemario sin tildes; la ñ se conserva como letra distinta.
- Modo de crecimiento por defecto: `rellenar` (rellenar huecos primero). Los otros son `fuera` y `mixto`.
- Derrota (solo supervivencia): tablero sin casillas o sin ninguna palabra posible.
- Todos los valores numéricos del juego viven en `src/config.js`.
- Todo el aleatorio entra por un `rng: () => number` inyectado, para que los tests sean deterministas.

## Revisión: casos que la especificación implica y ninguna tarea cubriría por sí sola

Cada línea tiene su test en la tarea indicada.

1. Un lemario con líneas vacías, `\r\n`, espacios, mayúsculas, tildes y caracteres no alfabéticos debe cargarse sin romper y sin aceptar basura (Tarea 2).
2. Un evento que elimina todas las casillas lleva a derrota sin lanzar excepciones (Tareas 5 y 8).
3. Crecer en modo `rellenar` sin huecos crece hacia fuera en vez de no hacer nada (Tarea 4).
4. Repetir una palabra ya puntuada se rechaza con motivo `repetida` y no cambia el tablero ni la puntuación (Tarea 8).
5. Un camino que pasa por una casilla congelada se rechaza (Tarea 5).

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `package.json` | `"type": "module"` y script `test`. |
| `src/config.js` | Constantes del juego (valores de la especificación). |
| `src/rng.js` | Generador pseudoaleatorio con semilla. |
| `src/hex.js` | Geometría hexagonal. |
| `src/lemario.js` | Normalización, trie, validación, letras y palabras aleatorias. |
| `src/tablero.js` | Estado del tablero, caminos, palabras posibles, garantía de palabra. |
| `src/crecimiento.js` | Eliminar, renovar y crecer. |
| `src/eventos.js` | Eventos como datos, alcance, efectos y modo activo. |
| `src/ia.js` | `validarPalabra` y `siguienteEvento` (simulados). |
| `src/modos.js` | Temas y misiones. |
| `src/partida.js` | Coordina una jugada completa (no figura en la tabla de módulos de la especificación; es el coordinador de las reglas de modos y eventos). |
| `src/ui.js`, `src/main.js`, `index.html`, `styles.css` | Interfaz SVG y entrada del jugador. |
| `data/lemario-muestra.txt` | Muestra de lemario. |
| `data/temas/halloween.json`, `data/temas/navidad.json` | Paquetes de tema. |
| `test/*.test.js` | Un archivo de test por módulo. |

---

### Tarea 1: Andamiaje, configuración, rng y geometría hexagonal

**Archivos:**
- Crear: `package.json`, `src/config.js`, `src/rng.js`, `src/hex.js`
- Test: `test/hex.test.js`, `test/rng.test.js`

**Interfaces:**
- Produce `src/config.js`: `LONGITUD_MINIMA=3`, `LETRAS_POR_CASILLA_NUEVA=2`, `EVENTO_CADA_PALABRAS=3`, `PROBABILIDAD_ESPECIAL=0.1`, `RADIO_INICIAL=1`, `MODO_POR_DEFECTO='rellenar'`, `FRECUENCIAS_LETRAS: Record<string, number>` (frecuencias del español para a-z y ñ, sin k y w si se desea, pero con todas las letras de la a a la z y la ñ presentes).
- Produce `src/rng.js`: `crearRng(semilla: number): () => number` (mulberry32; valores en `[0,1)`).
- Produce `src/hex.js`: `clave(q, r): string`, `vecinos(q, r): {q,r}[]` (6), `distancia(a, b): number`, `anillo(radio: number, centro?: {q,r}): {q,r}[]`, `aPixel(q, r, tamano): {x, y}` (hexágono con vértice arriba: `x = tamano·√3·(q + r/2)`, `y = tamano·1.5·r`).

- [ ] **Paso 1: `git init`, crear `package.json`** con `"type": "module"` y `"scripts": {"test": "node --test"}`.
- [ ] **Paso 2: escribir los tests que fallan**
  - `hex.test.js`: `clave(1,-2) === '1,-2'`; `vecinos(0,0)` son 6 casillas distintas, todas a `distancia` 1; `distancia({q:0,r:0},{q:2,r:-1}) === 2` y `distancia({q:0,r:0},{q:2,r:1}) === 3`; `anillo(1).length === 6`, `anillo(2).length === 12` y todas a distancia igual al radio; `aPixel(0,0,10)` es `{x:0,y:0}` y `aPixel(1,0,10).x` ≈ `10*Math.sqrt(3)`.
  - `rng.test.js`: dos `crearRng(42)` producen la misma secuencia de 5 valores; todos en `[0,1)`.
- [ ] **Paso 2b: ejecutar `npm test`** y comprobar que falla por módulos inexistentes.
- [ ] **Paso 3: implementar** `config.js`, `rng.js` y `hex.js` con las firmas de arriba.
- [ ] **Paso 4: ejecutar `npm test`**; esperado: todos los tests pasan.
- [ ] **Paso 5: commit** `git add . && git commit -m "feat: andamiaje, config, rng y geometría hexagonal"`

---

### Tarea 2: Lemario

**Archivos:**
- Crear: `src/lemario.js`, `data/lemario-muestra.txt` (al menos 300 palabras españolas comunes de 3 o más letras, incluyendo todas las `palabrasObjetivo` de los temas de la Tarea 7 y palabras de uso cotidiano con letras frecuentes)
- Test: `test/lemario.test.js`

**Interfaces:**
- Consume: `LONGITUD_MINIMA`, `FRECUENCIAS_LETRAS` de `config.js`.
- Produce: `normalizar(palabra: string): string` (minúsculas, sin tildes ni diéresis, conserva `ñ`); `cargarLemario(texto: string): Lemario`; `Lemario` con `existe(palabra): boolean`, `esPrefijo(prefijo): boolean`, `letraAleatoria(rng): string`, `palabraAleatoria(rng, longitud = 3): string | null`, `tamano: number`.

- [ ] **Paso 1: escribir los tests que fallan**
  - `normalizar('ÁRBOL') === 'arbol'`, `normalizar('Año') === 'año'`, `normalizar('pingüino') === 'pinguino'`.
  - Caso 1 de la revisión: `cargarLemario('Casa\r\n\n  perro  \nÁrbol\nab\nco2\nabc-d')`: `existe('casa')`, `existe('ARBOL')`, `existe('perro')` son `true`; `existe('ab')`, `existe('co2')`, `existe('abc-d')` son `false`; `tamano === 3`.
  - `esPrefijo('pe') === true`, `esPrefijo('pz') === false`, `esPrefijo('') === true`.
  - `letraAleatoria`: con un `crearRng(1)` y 2000 muestras, todas son claves de `FRECUENCIAS_LETRAS` y `'e'` aparece más veces que `'z'`.
  - `palabraAleatoria(rng, 3)` devuelve una palabra de longitud 3 del lemario (`'sol'` si es la única) y `null` si no hay ninguna de esa longitud.
  - El archivo `data/lemario-muestra.txt` cargado con `cargarLemario` tiene `tamano >= 300`.
- [ ] **Paso 2: ejecutar** `node --test test/lemario.test.js`; esperado: FALLA.
- [ ] **Paso 3: implementar** `src/lemario.js`. `normalizar` descompone en NFD y elimina marcas combinantes, protegiendo la `ñ` (por ejemplo, sustituyéndola por un marcador antes y restaurándola después). El lemario ignora al cargar las líneas que, tras normalizar y recortar, tengan menos de `LONGITUD_MINIMA` letras o caracteres fuera de `a-z` y `ñ`. El trie es un `Map` anidado. `letraAleatoria` hace una elección ponderada por `FRECUENCIAS_LETRAS`.
- [ ] **Paso 4: ejecutar** `node --test test/lemario.test.js`; esperado: PASA.
- [ ] **Paso 5: commit** `git add . && git commit -m "feat: lemario con trie y normalización"`

---

### Tarea 3: Tablero, caminos y palabras posibles

**Archivos:**
- Crear: `src/tablero.js`
- Test: `test/tablero.test.js`

**Interfaces:**
- Consume: `clave`, `vecinos`, `anillo` (hex); `Lemario` (Tarea 2); `LONGITUD_MINIMA`, `RADIO_INICIAL`.
- Produce:
  - Tipo `Casilla = { q, r, letra: string, especial: null | {tipo:'modo', modo:'rellenar'|'fuera'|'mixto'} | {tipo:'eliminar'}, congeladaHasta: number, ocultaHasta: number }` (los dos últimos por defecto `0`).
  - `class Tablero { casillas: Map<string, Casilla>; huecos: Set<string>; turno: number; casilla(q, r): Casilla | undefined; poner(q, r, letra): Casilla }`.
  - `tableroDesde(lista: {q, r, letra}[]): Tablero` (ayuda para los tests de todas las tareas).
  - `caminoValido(tablero, camino: {q,r}[]): { valido: boolean, motivo?: 'corto'|'no-existe'|'no-vecinas'|'repetida-consecutiva'|'congelada' }` (una casilla está congelada si `congeladaHasta > tablero.turno`).
  - `palabraDeCamino(tablero, camino): string`.
  - `hayPalabraPosible(tablero, lemario): boolean` (DFS con poda por `esPrefijo`; puede reutilizar casillas y no se queda en la misma casilla dos pasos seguidos; ignora casillas congeladas).
  - `garantizarPalabraPosible(tablero, lemario, rng): boolean` (si ya hay palabra posible devuelve `true`; si no, escribe una palabra de 3 letras del lemario en 3 casillas distintas encadenadas por vecindad y devuelve `true`; devuelve `false` si el tablero no tiene tal cadena).
  - `crearTableroInicial(lemario, rng): Tablero` (7 casillas con letras de `letraAleatoria`, luego `garantizarPalabraPosible`).

- [ ] **Paso 1: escribir los tests que fallan**
  - `caminoValido`: `[]` y un camino de 2 casillas dan `motivo: 'corto'`; `[A,B]` con `(0,0)` y `(1,1)` más una tercera da `'no-vecinas'`; `[A,A,B]` da `'repetida-consecutiva'`; casilla inexistente da `'no-existe'`; `[A,B,A]` con A, B vecinas es válido (repite casilla no consecutiva).
  - `palabraDeCamino` con A=`'a'`, B=`'l'` y camino `[A,B,A]` devuelve `'ala'`.
  - `hayPalabraPosible`: tablero de dos casillas vecinas `a` y `l`: con lemario `['ala']` es `true` (necesita reutilizar), con `['alma']` es `false`.
  - `garantizarPalabraPosible`: tres casillas mutuamente vecinas con letras `x`, lemario `['sol']` devuelve `true` y luego `hayPalabraPosible` es `true`; con un tablero de 2 casillas devuelve `false`.
  - `crearTableroInicial(lemario con ['sol'], crearRng(7))`: 7 casillas cuyas claves son el centro más `anillo(1)`, cada letra de un carácter, y `hayPalabraPosible` es `true`.
  - El test de casilla congelada del caso 5 se completa en la Tarea 5.
- [ ] **Paso 2: ejecutar** `node --test test/tablero.test.js`; esperado: FALLA.
- [ ] **Paso 3: implementar** `src/tablero.js` con las firmas de arriba.
- [ ] **Paso 4: ejecutar** `node --test test/tablero.test.js`; esperado: PASA.
- [ ] **Paso 5: commit** `git add . && git commit -m "feat: tablero, caminos y palabras posibles"`

---

### Tarea 4: Eliminar, renovar y crecer

**Archivos:**
- Crear: `src/crecimiento.js`
- Test: `test/crecimiento.test.js`

**Interfaces:**
- Consume: `Tablero`, `tableroDesde`, `clave`, `vecinos`, `Lemario.letraAleatoria`, `PROBABILIDAD_ESPECIAL`.
- Produce:
  - `eliminarCasillas(tablero, claves: string[]): number` (quita las existentes, las añade a `tablero.huecos`, devuelve cuántas quitó; ignora claves inexistentes).
  - `renovarLetras(tablero, camino: {q,r}[], lemario, rng): void` (nueva letra para cada casilla distinta del camino; borra su marca y le asigna otra con probabilidad `PROBABILIDAD_ESPECIAL` mediante `marcaAleatoria`).
  - `marcaAleatoria(rng): {tipo:'modo', modo} | {tipo:'eliminar'}`.
  - `crecer(tablero, cantidad: number, modo: 'rellenar'|'fuera'|'mixto', lemario, rng): { anadidas: number, rellenadas: number }`. `rellenar`: ocupa huecos y, si se acaban, el resto crece hacia fuera. `fuera`: añade solo en el borde (posiciones libres vecinas de alguna casilla y que no sean huecos), dejando los huecos intactos. `mixto`: `ceil(cantidad / 2)` en huecos y el resto hacia fuera. Un tablero vacío devuelve `{anadidas: 0, rellenadas: 0}`. `rellenadas` cuenta las casillas que ocuparon un hueco; los huecos ocupados salen de `tablero.huecos`.

- [ ] **Paso 1: escribir los tests que fallan**
  - `eliminarCasillas` quita las casillas, registra los huecos, devuelve el número quitado e ignora claves desconocidas.
  - `crecer('rellenar')` con 2 huecos y `cantidad` 3: `anadidas === 3`, `rellenadas === 2`, `huecos` vacío, el tamaño sube en 3.
  - Caso 3 de la revisión: `crecer('rellenar')` sin huecos y `cantidad` 2: `anadidas === 2`, `rellenadas === 0`.
  - `crecer('fuera')` con huecos: los huecos siguen en `tablero.huecos`, `rellenadas === 0`, y cada casilla nueva está a distancia 1 de alguna casilla ya existente.
  - `crecer('mixto')` con 5 huecos y `cantidad` 4: `anadidas === 4`, `rellenadas === 2`.
  - `crecer` en tablero vacío devuelve ceros.
  - `renovarLetras` con camino `[A,B,A]`: solo A y B cambian de letra (las demás casillas intactas) y la nueva letra es una clave de `FRECUENCIAS_LETRAS`.
- [ ] **Paso 2: ejecutar** `node --test test/crecimiento.test.js`; esperado: FALLA.
- [ ] **Paso 3: implementar** `src/crecimiento.js` con las firmas de arriba.
- [ ] **Paso 4: ejecutar** `node --test test/crecimiento.test.js`; esperado: PASA.
- [ ] **Paso 5: commit** `git add . && git commit -m "feat: eliminar, renovar y crecer casillas"`

---

### Tarea 5: Eventos

**Archivos:**
- Crear: `src/eventos.js`
- Test: `test/eventos.test.js`

**Interfaces:**
- Consume: `Tablero`, `eliminarCasillas`, `distancia`, `clave`, `MODO_POR_DEFECTO`, `caminoValido`.
- Produce:
  - Tipo `Evento = { tipo: 'eliminar'|'congelar'|'ocultar', alcance: {centro:{q,r}, radio:number} | {claves:string[]}, duracion: number, modoCrecimiento: 'rellenar'|'fuera'|'mixto'|null }`.
  - `EVENTOS_BASE`: lista de plantillas `Evento` sin `centro` (solo `{radio}` en el alcance) con al menos un evento de cada tipo, y al menos uno con `modoCrecimiento: 'fuera'` y otro con `'rellenar'`.
  - `casillasEnAlcance(tablero, alcance): string[]` (solo casillas existentes).
  - `aplicarEvento(tablero, evento): void` (`eliminar` quita las casillas; `congelar` pone `congeladaHasta = tablero.turno + duracion`; `ocultar` pone `ocultaHasta = tablero.turno + duracion`).
  - `eventoDeMarca(casilla): Evento | null` (marca `{tipo:'eliminar'}` devuelve un evento `eliminar` con alcance `{centro:{q,r} de la casilla, radio:1}`, `duracion:0`, `modoCrecimiento:null`; las marcas `modo` devuelven `null`).
  - `modoActivo(eventosActivos: {evento, hastaTurno}[], turno: number, porDefecto?: string): string` (el `modoCrecimiento` no nulo del evento activo más reciente; un evento está activo si `hastaTurno > turno`).

- [ ] **Paso 1: escribir los tests que fallan**
  - `casillasEnAlcance` con `{centro:{q:0,r:0}, radio:1}` en un tablero de 7 casillas devuelve las 7; con `{claves:['0,0','9,9']}` devuelve solo `['0,0']`.
  - Caso 2 de la revisión: `aplicarEvento` con `eliminar` y radio 1 sobre el tablero de 7 casillas deja `casillas.size === 0` y `huecos.size === 7` sin lanzar excepción.
  - Caso 5 de la revisión: tras `aplicarEvento` con `congelar` y `duracion: 2` a `turno: 0`, `caminoValido` de un camino de 3 casillas que incluya una congelada devuelve `{valido:false, motivo:'congelada'}`; al avanzar `tablero.turno = 2` el mismo camino es válido.
  - `ocultar` fija `ocultaHasta = turno + duracion`.
  - `eventoDeMarca` con la marca `eliminar` devuelve el evento descrito; con una marca `modo` devuelve `null`.
  - `modoActivo([], 5)` es `'rellenar'`; con un evento `fuera` y `hastaTurno: 8` es `'fuera'` en el turno 5 y vuelve a `'rellenar'` en el turno 8.
- [ ] **Paso 2: ejecutar** `node --test test/eventos.test.js`; esperado: FALLA.
- [ ] **Paso 3: implementar** `src/eventos.js` con las firmas de arriba.
- [ ] **Paso 4: ejecutar** `node --test` (todo el conjunto); esperado: PASA.
- [ ] **Paso 5: commit** `git add . && git commit -m "feat: eventos como datos y modo de crecimiento activo"`

---

### Tarea 6: IA simulada

**Archivos:**
- Crear: `src/ia.js`
- Test: `test/ia.test.js`

**Interfaces:**
- Consume: `Lemario`, `EVENTOS_BASE`, `Evento`, `Tablero`.
- Produce: `crearIaSimulada({ lemario, rng }): Ia` con
  - `validarPalabra(palabra: string, contexto: object): Promise<{ valida: boolean, motivo?: string }>` (consulta el lemario; motivo `'no-esta-en-el-lemario'`);
  - `siguienteEvento(estado: { tablero: Tablero }, modo: string, tema: Tema | null): Promise<Evento>` (elige al azar de `tema.eventos` si existe y, si no, de `EVENTOS_BASE`; devuelve una copia con `alcance.centro` elegido al azar entre las casillas existentes del tablero, o `{q:0,r:0}` si no hay ninguna).

- [ ] **Paso 1: escribir los tests que fallan** (con `await`)
  - `validarPalabra('casa')` con `casa` en el lemario devuelve `{valida:true}`; `'zzz'` devuelve `{valida:false, motivo:'no-esta-en-el-lemario'}`; `'ÁRBOL'` es válida si `arbol` está.
  - `siguienteEvento` sin tema: `tipo` en `['eliminar','congelar','ocultar']`, `duracion` numérico y `alcance.centro` presente y cuya clave existe en el tablero.
  - Con un tema de un solo evento, devuelve una copia de ese evento (no el mismo objeto).
- [ ] **Paso 2: ejecutar** `node --test test/ia.test.js`; esperado: FALLA.
- [ ] **Paso 3: implementar** `src/ia.js`.
- [ ] **Paso 4: ejecutar** `node --test test/ia.test.js`; esperado: PASA.
- [ ] **Paso 5: commit** `git add . && git commit -m "feat: interfaz de IA con implementación simulada"`

---

### Tarea 7: Temas y misiones

**Archivos:**
- Crear: `src/modos.js`, `data/temas/halloween.json`, `data/temas/navidad.json`
- Test: `test/modos.test.js`

**Interfaces:**
- Consume: `normalizar`, `Evento`.
- Produce:
  - Tipo `Tema = { nombre: string, paleta: {fondo, casilla, texto, acento}, eventos: Evento[] (sin centro), palabrasObjetivo: string[], retos: {tipo:'longitud'|'tema'|'regenerar', meta:number}[] }`.
  - `cargarTema(json: object): Tema` (lanza `Error` cuyo mensaje nombra el campo que falta o es inválido).
  - `crearMision(tema): Mision` con `objetivos: {id, tipo, meta, progreso, cumplido}[]`.
  - `actualizarMision(mision, resultado: { palabra: string, casillasRegeneradas: number }, tema): void` (`longitud` se cumple si `palabra.length >= meta`; `tema` suma 1 cuando la palabra normalizada está en `palabrasObjetivo` normalizadas y se cumple al llegar a `meta`; `regenerar` suma `casillasRegeneradas`).
  - `misionCumplida(mision): boolean`.
  - Los dos JSON de tema: cada uno con al menos 2 eventos propios, al menos 10 `palabrasObjetivo` (todas presentes en `data/lemario-muestra.txt`), al menos 2 retos y paleta completa.

- [ ] **Paso 1: escribir los tests que fallan**
  - Los dos JSON pasan `cargarTema` y sus `palabrasObjetivo` existen todas en el lemario cargado desde `data/lemario-muestra.txt`.
  - `cargarTema({ nombre: 'x' })` lanza un `Error` cuyo mensaje contiene `eventos`.
  - `actualizarMision`: un reto `longitud` con `meta: 5` queda cumplido con `'perros'` y no con `'sol'`; un reto `tema` con `meta: 2` se cumple tras dos palabras objetivo distintas; un reto `regenerar` con `meta: 3` acumula `casillasRegeneradas`.
  - `misionCumplida` es `true` solo cuando todos los objetivos están cumplidos.
- [ ] **Paso 2: ejecutar** `node --test test/modos.test.js`; esperado: FALLA.
- [ ] **Paso 3: implementar** `src/modos.js` y escribir los dos JSON de tema.
- [ ] **Paso 4: ejecutar** `node --test test/modos.test.js`; esperado: PASA.
- [ ] **Paso 5: commit** `git add . && git commit -m "feat: temas y misiones"`

---

### Tarea 8: Partida

**Archivos:**
- Crear: `src/partida.js`
- Test: `test/partida.test.js`

**Interfaces:**
- Consume: todo lo anterior (`caminoValido`, `palabraDeCamino`, `garantizarPalabraPosible`, `hayPalabraPosible`, `crearTableroInicial`, `renovarLetras`, `crecer`, `aplicarEvento`, `eventoDeMarca`, `modoActivo`, `Ia`, `actualizarMision`, `misionCumplida`).
- Produce:
  - `crearPartida({ modo: 'supervivencia'|'misiones', tema?: Tema, lemario, ia, rng, eventoCada = EVENTO_CADA_PALABRAS }): Partida` con `tablero`, `puntos`, `palabrasUsadas: Set<string>`, `eventosActivos: {evento, hastaTurno}[]`, `estado: 'jugando'|'derrota'|'victoria'`, `mision?`.
  - `jugarPalabra(partida, camino): Promise<{ aceptada: boolean, motivo?: string, palabra?: string, puntos?: number, anadidas?: number, evento?: Evento }>`.
- Orden de una jugada aceptada: validar camino, normalizar y comprobar repetida (`'repetida'`), `ia.validarPalabra`, sumar puntos, anotar la palabra, renovar letras, elegir modo (la primera marca `modo` del camino, si no `modoActivo`), `crecer` con `max(1, floor(longitud / 2))`, `garantizarPalabraPosible`, avanzar `tablero.turno`, disparar eventos (la marca `eliminar` de las casillas usadas y, cada `eventoCada` palabras, `ia.siguienteEvento`; los eventos con duración se guardan en `eventosActivos`), actualizar la misión y comprobar el final. Las jugadas rechazadas no cambian nada.
- Final: en supervivencia, `derrota` si `tablero.casillas.size === 0` o `!hayPalabraPosible`. En misiones no hay derrota: si el tablero queda vacío o sin palabras posibles, se reinicia con `crearTableroInicial`; `victoria` cuando `misionCumplida`.

- [ ] **Paso 1: escribir los tests que fallan** (tableros con `tableroDesde` y la IA simulada o un doble que devuelve eventos fijos)
  - Palabra válida de 3 letras: `puntos === 9`, `anadidas === 1`, las casillas del camino cambian de letra; de 4 letras: `puntos === 16`, `anadidas === 2`.
  - Caso 4 de la revisión: repetir la misma palabra devuelve `{aceptada:false, motivo:'repetida'}` y deja `puntos` y el tamaño del tablero iguales.
  - Palabra fuera del lemario: `aceptada: false` con el motivo de la IA y tablero intacto; camino de 2 casillas: `motivo: 'corto'`.
  - Una casilla del camino con marca `{tipo:'modo', modo:'fuera'}` hace que los huecos previos sigan en `tablero.huecos`.
  - Caso 2 de la revisión: con `eventoCada: 1` y una IA que devuelve un `eliminar` de radio 5, la partida de supervivencia pasa a `estado === 'derrota'` sin excepciones.
  - Misiones: tras cumplir un reto de `longitud`, `estado === 'victoria'`; con un evento que vacía el tablero, el tablero se reinicia a 7 casillas y `estado === 'jugando'`.
  - Un evento con `duracion: 2` sigue en `eventosActivos` tras la jugada y desaparece de `modoActivo` cuando pasan 2 turnos.
- [ ] **Paso 2: ejecutar** `node --test test/partida.test.js`; esperado: FALLA.
- [ ] **Paso 3: implementar** `src/partida.js`.
- [ ] **Paso 4: ejecutar** `npm test`; esperado: todos los tests pasan.
- [ ] **Paso 5: commit** `git add . && git commit -m "feat: coordinación de partida en supervivencia y misiones"`

---

### Tarea 9: Interfaz web

**Archivos:**
- Crear: `index.html`, `styles.css`, `src/ui.js`, `src/main.js`
- Test: `test/ui.test.js` (solo la función pura)

**Interfaces:**
- Consume: `aPixel`, `clave`, `crearPartida`, `jugarPalabra`, `cargarLemario`, `crearIaSimulada`, `cargarTema`, `crearRng`.
- Produce: `puntosDeHexagono(cx: number, cy: number, tamano: number): string` (atributo `points` de SVG con 6 pares `x,y`); `dibujarTablero(svg, partida, tamano)` (un hexágono por casilla con `data-clave`; oculta la letra como `?` si `ocultaHasta > turno`, estilo distinto para congeladas, icono para marcas especiales); `main.js` conecta todo.
- Comportamiento: selección con eventos de puntero (arrastrar por casillas vecinas con `document.elementFromPoint`, o tocarlas una a una), la palabra en construcción visible, el camino resaltado, enviar al soltar o con un botón «Enviar» y cancelar con «Borrar». Panel con puntuación, modo, evento activo y objetivos de la misión. Selectores de modo y de tema (los colores salen de `tema.paleta` mediante variables CSS). Carga de `data/lemario-muestra.txt` con `fetch` y un `<input type="file">` para cargar un lemario propio. Mensajes de derrota y victoria y botón «Nueva partida».

- [ ] **Paso 1: escribir el test que falla**: `puntosDeHexagono(0, 0, 10)` devuelve una cadena con 6 pares `x,y` y todos los vértices están a distancia 10 del centro (tolerancia 0.01).
- [ ] **Paso 2: ejecutar** `node --test test/ui.test.js`; esperado: FALLA.
- [ ] **Paso 3: implementar** `src/ui.js`, `src/main.js`, `index.html` y `styles.css`.
- [ ] **Paso 4: ejecutar** `npm test`; esperado: PASA.
- [ ] **Paso 5: verificación manual**: servir con `python3 -m http.server 8000`, abrir `http://localhost:8000` y comprobar:
  - al empezar aparecen 7 hexágonos con letra;
  - se puede formar una palabra de 3 letras arrastrando, con una casilla repetida (por ejemplo `ala`), y el tablero crece y las letras usadas cambian;
  - una palabra inexistente muestra un mensaje y no cambia el tablero;
  - al cambiar al modo de misiones y elegir Halloween cambian los colores y aparecen los objetivos;
  - tras unas palabras ocurre un evento que elimina o congela casillas y se ven los huecos;
  - la partida de supervivencia termina con mensaje de derrota cuando el tablero se queda sin casillas.
- [ ] **Paso 6: commit** `git add . && git commit -m "feat: interfaz web SVG con modos y temas"`

---

## Autorevisión

- **Cobertura de la especificación:** tablero y casillas (T3); formar palabras (T3); efecto de una palabra y modos de crecimiento (T4, T8); eventos y letras especiales (T4, T5); modos y temas (T7, T8); valores iniciales (T1, T2, T8); interfaz de IA (T6); arquitectura e interfaz (T9); pruebas (todas).
- **Consistencia de tipos:** `Tablero`, `Casilla`, `Evento`, `Tema` y las firmas de cada tarea coinciden en las tareas que las consumen.
- **Decisiones que el plan añade a la especificación:** el módulo `partida.js` como coordinador; `garantizarPalabraPosible` escribe una palabra del lemario si las letras nuevas dejan el tablero sin palabra posible (en vez de solo reintentar letras al azar); en misiones el tablero se reinicia en vez de dar derrota; probabilidad de letra especial `0.1`; eventos automáticos cada 3 palabras.
