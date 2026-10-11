# Generador de tableros y letras: plan de implementación

> **Para quien ejecute el plan:** SUB-HABILIDAD OBLIGATORIA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar el plan tarea por tarea. Los pasos usan casillas `- [ ]` para el seguimiento.

**Objetivo:** sustituir el sorteo de letras por frecuencia por un generador local que siembra palabras reales, elige letras por combinaciones con el lemario y garantiza siempre una palabra larga.

**Arquitectura:** un motor de colocación (`colocacion.js`) busca palabras del lemario como caminos de casillas vecinas sobre una rejilla de celdas. Tres piezas lo usan: `siembra.js` (tablero inicial), `letras.js` (renovar, crecer y rellenar huecos) y `garantia.js` (palabra de N letras). `generador.js` es la fachada con la interfaz fija que `partida.js` recibe por parámetro, igual que la IA.

**Tecnología:** JavaScript con módulos ES, `node --test`, sin dependencias. Rama de trabajo: `feature/generador`.

**Especificación:** `docs/2026-10-11-generador-tableros-design.md` (amplía `docs/2026-10-07-juego-palabras-hexagonal-design.md`).

## Restricciones globales

- Sin servidor, sin claves de API, sin dependencias de runtime.
- Todo el aleatorio entra por un `rng: () => number` inyectado. Mismo `rng` con la misma semilla, mismo resultado.
- Valores iniciales de `GENERADOR` (en `src/config.js`): `radioInicial: 3`, `densidad: 'media'`, `densidades: { suave: 0.35, media: 0.60, densa: 0.85 }`, `longitudSembrada: { min: 5, max: 9 }`, `prioridadEncaje: 0.7`, `mezclaPesos: 0.5`, `longitudGarantizada: 6`, `presupuestoIntentos: 2000`.
- Una palabra sembrada ocupa casillas distintas (camino sin repetir casilla). El jugador sí puede repetir casillas al jugar.
- `longitudSembrada.min` y `longitudGarantizada` nunca bajan de `LONGITUD_MINIMA` (3).
- Un "intento" es una llamada a `buscarColocaciones`. Cada búsqueda está acotada además por `MAX_NODOS_BUSQUEDA = 5000` nodos expandidos.
- Las casillas congeladas (`congeladaHasta > tablero.turno`) nunca se modifican. La comprobación de la garantía las cuenta como disponibles.
- Eventos, marcas especiales, puntuación, modos de crecimiento y reglas de derrota y victoria no cambian.
- Los 78 tests existentes siguen pasando (los que dependan de 7 casillas iniciales fijan `radioInicial: 1` explícitamente; se conserva la intención de cada aserción).
- Cada mensaje de commit termina, tras una línea en blanco, con estas dos líneas:
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01UdBrh5ebEnHL6UvhsQAW7n`

## Revisión: casos que la especificación implica y que ningún test de tarea cubriría solo

Cada línea tiene su test en la tarea indicada.

1. Un lemario vacío o sin ninguna palabra de la longitud pedida no cuelga ni lanza excepción en ninguna función del generador (Tareas 5 y 6).
2. Un radio 0 (una casilla) o muy pequeño, con longitudes mayores que el número de casillas, devuelve un tablero válido con letra en cada casilla (Tarea 6).
3. Con todas las casillas congeladas, la reparación de la garantía no modifica ninguna letra (Tarea 5).
4. Una configuración con valores fuera de rango, de tipo erróneo o contradictorios se normaliza sin lanzar excepción (Tarea 1).
5. Un tablero de radio 5 con un lemario de 5000 palabras se genera sin colgarse (Tarea 6).

---

### Tarea 1: Configuración del generador

**Archivos:**
- Modificar: `src/config.js`
- Test: `test/config.test.js`

**Interfaces:**
- Produce: `GENERADOR` (valores de las restricciones globales), `MAX_NODOS_BUSQUEDA = 5000`, y `normalizarConfig(config?: object): object`. Devuelve un objeto nuevo (no muta la entrada ni `GENERADOR`) con los valores por defecto rellenados y estas reglas:
  - `prioridadEncaje` y `mezclaPesos` se recortan a `[0, 1]`; un valor no numérico usa el valor por defecto.
  - `densidad` desconocida pasa a `'media'`.
  - `longitudSembrada.min` y `longitudGarantizada` suben a `LONGITUD_MINIMA` si son menores; si `max < min`, `max = min`.
  - `radioInicial` es un entero `>= 0` (se trunca; negativo pasa a 0).
  - `presupuestoIntentos` es un entero `>= 1`.

- [ ] **Paso 1: escribir los tests que fallan.** `normalizarConfig()` es igual a `GENERADOR` (`deepStrictEqual`); `({ prioridadEncaje: 5 }).prioridadEncaje === 1`; `({ mezclaPesos: -1 }).mezclaPesos === 0`; `({ mezclaPesos: 'a' }).mezclaPesos === 0.5`; `({ densidad: 'xyz' }).densidad === 'media'`; `({ longitudSembrada: { min: 1, max: 2 } }).longitudSembrada` es `{ min: 3, max: 3 }`; `({ longitudSembrada: { min: 9, max: 5 } }).longitudSembrada` es `{ min: 9, max: 9 }`; `({ longitudGarantizada: 1 }).longitudGarantizada === 3`; `({ radioInicial: -2 }).radioInicial === 0`; `({ radioInicial: 2.7 }).radioInicial === 2`; `({ presupuestoIntentos: 0 }).presupuestoIntentos === 1`; `normalizarConfig(null)` y `normalizarConfig({ densidades: 5 })` no lanzan y devuelven valores por defecto; tras todas las llamadas `GENERADOR` sigue igual que al principio.
- [ ] **Paso 2: ejecutar** `node --test test/config.test.js`; esperado: FALLA.
- [ ] **Paso 3: implementar** en `src/config.js`. Conservar las constantes existentes (incluida `RADIO_INICIAL`, que se elimina en la Tarea 8).
- [ ] **Paso 4: ejecutar** `node --test test/config.test.js`; esperado: PASA.
- [ ] **Paso 5: commit** `git add . && git commit -m "feat: configuración del generador con normalización"` (más las dos líneas finales).

---

### Tarea 2: Ampliaciones del lemario

**Archivos:**
- Modificar: `src/lemario.js`
- Test: `test/lemario.test.js` (añadir)

**Interfaces:**
- Consume: la estructura existente de `Lemario` (`palabras`, trie en `raiz`, `normalizar`).
- Produce, en `Lemario`, con los índices calculados una sola vez en el constructor:
  - `palabrasDeLongitud(n: number): string[]` (en orden de inserción; `[]` si no hay).
  - `siguientesLetras(prefijo: string): string[]` (letras que continúan el prefijo normalizado, en orden alfabético ascendente; `[]` si no es prefijo; con `''`, las letras iniciales).
  - `frecuenciaPar(a: string, b: string): number` (veces que `a` va seguida de `b` en las palabras; 0 si ninguna).
  - `get longitudMaxima(): number` (0 si el lemario está vacío).

- [ ] **Paso 1: escribir los tests que fallan** con `cargarLemario('sol\nsola\nmesa\ncasa')`: `palabrasDeLongitud(4)` es `['sola', 'mesa', 'casa']` y `palabrasDeLongitud(3)` es `['sol']`; `palabrasDeLongitud(9)` es `[]`; `siguientesLetras('so')` es `['l']`; `siguientesLetras('')` es `['c', 'm', 's']`; `siguientesLetras('zz')` es `[]`; `siguientesLetras('SÓ')` es `['l']`; `frecuenciaPar('s', 'o') === 2`, `frecuenciaPar('o', 'l') === 2`, `frecuenciaPar('s', 'a') === 2`, `frecuenciaPar('a', 's') === 1`, `frecuenciaPar('z', 'x') === 0`; `longitudMaxima === 4`; lemario vacío: `longitudMaxima === 0`, `palabrasDeLongitud(3)` es `[]`, `siguientesLetras('')` es `[]`.
- [ ] **Paso 2: ejecutar** `node --test test/lemario.test.js`; esperado: FALLA.
- [ ] **Paso 3: implementar** los cuatro miembros. Índices en el constructor: un `Map` longitud a lista y un `Map` de pares.
- [ ] **Paso 4: ejecutar** `node --test test/lemario.test.js`; esperado: PASA.
- [ ] **Paso 5: commit** `feat: lemario con índices por longitud, siguientes letras y pares`.

---

### Tarea 3: Motor de colocación

**Archivos:**
- Crear: `src/colocacion.js`
- Test: `test/colocacion.test.js`

**Interfaces:**
- Consume: `clave`, `vecinos` de `hex.js`; `Lemario.siguientesLetras`, `Lemario.existe`; `MAX_NODOS_BUSQUEDA`.
- Produce:
  - Tipo `Celda = { q, r, letra: string | null, fija: boolean }`. La rejilla es un `Map<string, Celda>` indexado por `clave(q, r)`.
  - Tipo `Colocacion = { palabra: string, camino: {q, r}[], cruces: number, asignadas: number, cambios: number }`.
  - `buscarColocaciones(rejilla: Map<string, Celda>, lemario: Lemario, opciones: { min: number, max: number, limite?: number (20), rng: () => number, maxNodos?: number }): Colocacion[]`.
- Reglas de la búsqueda: el camino son casillas distintas de la rejilla, cada una vecina de la anterior. Por cada celda del camino: `letra` no nula y `fija` obliga a que la letra de la palabra coincida (si no, el camino se descarta); `letra` no nula y no `fija` cuenta como `cruces` si coincide y como `cambios` si no; `letra` nula cuenta como `asignadas`. Se recorre guiado por `lemario.siguientesLetras`. Cada nodo expandido cuenta para `maxNodos`. El orden de las celdas de partida y de las letras se baraja con `rng`. Se devuelven como mucho `limite` colocaciones con longitud entre `min` y `max`, incluidas las que no asignan ni cambian nada (ya existen); quien llama las filtra.

- [ ] **Paso 1: escribir los tests que fallan** (rejilla de tres casillas colineales `(0,0)`, `(1,0)`, `(2,0)` con `letra: null`, lemario `['sol']`, `min: 3, max: 3`): devuelve 2 colocaciones con `palabra === 'sol'`, `camino` de 3 casillas, `asignadas === 3`, `cruces === 0`, `cambios === 0`; con la celda `(1,0)` `{ letra: 'o', fija: true }`: 2 colocaciones con `cruces === 1` y `asignadas === 2`; con `(1,0)` `{ letra: 'x', fija: true }`: `[]`; con `(1,0)` `{ letra: 'x', fija: false }`: colocaciones con `cambios === 1` y `cruces === 0`; lemario `['aba']` en una rejilla de 2 casillas: `[]` (no repite casilla); lemario `['sol', 'sola']` con `min: 3, max: 3`: solo `'sol'`; disco de radio 3 vacío con 40 palabras de 3 letras y `limite: 5`: como mucho 5; `maxNodos: 1`: no lanza y devuelve `[]`; mismo `crearRng(7)` dos veces: mismo resultado; rejilla vacía: `[]`.
- [ ] **Paso 2: ejecutar** `node --test test/colocacion.test.js`; esperado: FALLA.
- [ ] **Paso 3: implementar** `buscarColocaciones` con las reglas de arriba.
- [ ] **Paso 4: ejecutar** `node --test test/colocacion.test.js`; esperado: PASA.
- [ ] **Paso 5: commit** `feat: motor de colocación de palabras sobre rejilla`.

---

### Tarea 4: Elección de letras

**Archivos:**
- Crear: `src/letras.js`
- Test: `test/letras.test.js`

**Interfaces:**
- Consume: `buscarColocaciones`, `Celda` (Tarea 3); `Lemario.frecuenciaPar`, `Lemario.letraAleatoria`; `normalizarConfig`, `FRECUENCIAS_LETRAS`, `LONGITUD_MINIMA`; `clave`, `vecinos`; `Tablero`.
- Produce: `elegirLetras(tablero: Tablero, posiciones: {q, r}[], lemario: Lemario, config: object, rng: () => number): Map<string, string>` (clave de casilla a letra). No muta el tablero. Las posiciones se tratan como desconocidas, existan ya en el tablero o no; las duplicadas cuentan una vez; `[]` devuelve un `Map` vacío.
- Procedimiento (sección 6 de la especificación): se construye una rejilla con todas las casillas del tablero como `{ letra, fija: true }` y las posiciones como `{ letra: null, fija: false }`. Bucle de encaje: mientras queden posiciones sin letra y quede presupuesto, con probabilidad `prioridadEncaje` se hace una búsqueda (`min: LONGITUD_MINIMA`, `max: longitudSembrada.max`), se descartan las colocaciones con `asignadas < 1` o `cambios > 0`, se elige la de mayor `asignadas` y, a igualdad, la más larga, y se fijan sus letras. Si no sale ninguna, o falla el sorteo, se pasa al modelo mixto. Modelo mixto, de las posiciones más rodeadas de letras fijas a las menos (a igualdad, por `q` y luego `r`): puntuación `(1 - mezclaPesos) * frecuencia + mezclaPesos * combinaciones`, con `frecuencia = FRECUENCIAS_LETRAS[l] / máximo` y `combinaciones` = suma, sobre las vecinas fijas, de `frecuenciaPar(vecina, l) + frecuenciaPar(l, vecina)`, dividida por el máximo entre las candidatas (si el máximo es 0, `combinaciones = frecuencia`). Sorteo ponderado proporcional a la puntuación. Si se agota el presupuesto durante el encaje, las posiciones pendientes se rellenan con `lemario.letraAleatoria(rng)`.

- [ ] **Paso 1: escribir los tests que fallan.**
  - `elegirLetras(t, [], ...)` devuelve un `Map` vacío; posiciones duplicadas `[{q:0,r:0},{q:0,r:0}]` devuelven una sola entrada.
  - Con `mezclaPesos: 0, prioridadEncaje: 0`, 2000 sorteos con `crearRng(1)` sobre una posición aislada: todas las letras son claves de `FRECUENCIAS_LETRAS` y `'e'` sale más veces que `'z'`.
  - Encaje: tablero con `'s'` en `(0,0)` y `'l'` en `(2,0)`, posición `(1,0)`, lemario `['sol']`, `prioridadEncaje: 1`: el resultado es `Map { '1,0' => 'o' }`.
  - Encaje de varias: tres posiciones colineales sin vecinas fijas y lemario `['sol']`, `prioridadEncaje: 1`: las letras asignadas forman `'sol'` leídas en un sentido de la línea.
  - Mixto: una posición rodeada de `'q'` fijas, lemario `['queso', 'quien', 'quema']`, `mezclaPesos: 1, prioridadEncaje: 0`: en 200 sorteos con semillas distintas, `'u'` sale más de 150 veces.
  - Posición que aún no está en el tablero (casilla nueva vecina) se acepta y recibe letra.
  - `presupuestoIntentos: 1`, `prioridadEncaje: 1`, lemario con palabras imposibles: todas las posiciones reciben una letra de `FRECUENCIAS_LETRAS`, sin excepción.
  - El tablero no se modifica (mismas letras antes y después).
  - Lemario vacío: devuelve letras por frecuencia sin lanzar.
- [ ] **Paso 2: ejecutar** `node --test test/letras.test.js`; esperado: FALLA.
- [ ] **Paso 3: implementar** `elegirLetras` en `src/letras.js`.
- [ ] **Paso 4: ejecutar** `node --test test/letras.test.js`; esperado: PASA.
- [ ] **Paso 5: commit** `feat: elección de letras con encaje y modelo mixto`.

---

### Tarea 5: Garantía de palabra larga

**Archivos:**
- Crear: `src/garantia.js`
- Modificar: `src/tablero.js` (`hayPalabraPosible`)
- Test: `test/garantia.test.js`, `test/tablero.test.js` (añadir)

**Interfaces:**
- Consume: `buscarColocaciones` (Tarea 3); `hayPalabraPosible`, `garantizarPalabraPosible` de `tablero.js`; `normalizarConfig`; `LONGITUD_MINIMA`.
- Produce:
  - `hayPalabraPosible(tablero, lemario, { incluirCongeladas = false, longitudMinima = LONGITUD_MINIMA } = {}): boolean`. La palabra debe tener al menos `longitudMinima` letras.
  - `asegurarPalabraLarga(tablero: Tablero, lemario: Lemario, config: object, rng: () => number, opciones?: { preferir?: string[] }): boolean`. `N = max(LONGITUD_MINIMA, min(config.longitudGarantizada, lemario.longitudMaxima, casillas del tablero))`. Si `hayPalabraPosible(..., { incluirCongeladas: true, longitudMinima: N })`, devuelve `true` sin tocar nada. Si no, construye una rejilla con las casillas no congeladas como `{ letra, fija: false }`, busca colocaciones de longitud exactamente `N`, elige la de menos `cambios` (a igualdad, la que más casillas de `opciones.preferir` use, y luego al azar con `rng`), escribe sus letras y devuelve `true`. Si no hay ninguna, llama a `garantizarPalabraPosible(tablero, lemario, rng)` (la garantía mínima actual) y devuelve `false`.

- [ ] **Paso 1: escribir los tests que fallan.**
  - `hayPalabraPosible` con casillas `s`, `o`, `l` colineales y lemario `['sol', 'sola']`: `{ longitudMinima: 4 }` da `false`; con una cuarta casilla `a` vecina de `l` da `true`; sin la opción sigue dando `true` con tres casillas.
  - Ya existe palabra de N letras: devuelve `true` y no cambia ninguna letra.
  - Seis casillas colineales con `'x'` y lemario `['cabeza']`, `longitudGarantizada: 6`: devuelve `true`, `hayPalabraPosible(..., { longitudMinima: 6, incluirCongeladas: true })` es `true` y se cambiaron como mucho 6 letras.
  - `preferir`: dos regiones disjuntas de igual coste con el mismo lemario; con `preferir` apuntando a una, solo cambian casillas de esa región.
  - Caso 3 de la revisión: todas las casillas congeladas: no se modifica ninguna letra, no lanza, devuelve `false`.
  - Lemario con palabras de 5 letras como máximo y `longitudGarantizada: 6`: `N` baja a 5 y se garantiza una de 5.
  - Lemario vacío: devuelve `false` sin lanzar y sin modificar el tablero.
  - Tablero de 4 casillas y `longitudGarantizada: 6`: no lanza.
- [ ] **Paso 2: ejecutar** `node --test test/garantia.test.js test/tablero.test.js`; esperado: FALLA.
- [ ] **Paso 3: implementar** la opción `longitudMinima` y `asegurarPalabraLarga`.
- [ ] **Paso 4: ejecutar** `npm test`; esperado: PASA (los 78 anteriores más los nuevos).
- [ ] **Paso 5: commit** `feat: garantía de palabra larga con reparación mínima`.

---

### Tarea 6: Siembra del tablero inicial

**Archivos:**
- Crear: `src/siembra.js`, `test/helpers.js`
- Test: `test/siembra.test.js`

**Interfaces:**
- Consume: `buscarColocaciones`, `Celda`; `elegirLetras` (Tarea 4); `asegurarPalabraLarga` (Tarea 5); `Tablero`; `anillo`, `clave`; `normalizarConfig`; `GENERADOR`.
- Produce:
  - `test/helpers.js`: `lemarioSintetico(n: number, rng: () => number): Lemario` (devuelve un lemario de `n` palabras de 4 a 7 letras con consonante y vocal alternadas, determinista para un `rng` dado). Lo reutiliza la Tarea 8.
  - `sembrarPalabras(lemario, config, rng): { rejilla: Map<string, Celda>, palabras: { palabra: string, camino: {q, r}[] }[] }`: disco de radio `radioInicial` con celdas `{ letra: null, fija: false }`, sembrado según la sección 5 de la especificación. Cobertura objetivo: `densidades[densidad] * número de casillas`. Cada iteración es un intento: longitud sorteada entre `longitudSembrada.min` y `max` (recortada a `lemario.longitudMaxima` y al número de casillas) con probabilidad proporcional a la longitud, una búsqueda con esa longitud exacta, filtrado de colocaciones con `asignadas >= 1` y `cambios === 0`, y selección según la densidad: `'media'` exige `cruces >= 1` salvo la primera palabra; `'suave'` exige `cruces >= 1` solo para la segunda palabra; `'densa'` toma la de más cruces y acepta `cruces >= 1` (salvo la primera). Las letras de la colocación elegida pasan a `{ letra, fija: true }`. Termina al alcanzar la cobertura o al agotar `presupuestoIntentos`.
  - `sembrarTablero(lemario: Lemario, config: object, rng: () => number): Tablero`: llama a `sembrarPalabras`, crea un `Tablero` con todas las casillas del disco (las sembradas con su letra), rellena las sin letra con `elegirLetras` y termina con `asegurarPalabraLarga`.

- [ ] **Paso 1: escribir los tests que fallan.**
  - `sembrarTablero` con `radioInicial: 2` devuelve 19 casillas, todas con una letra de una posición (`a` a `z` o `ñ`).
  - Cada palabra de `sembrarPalabras` cumple `palabraDeCamino(tablero, camino) === palabra` sobre el tablero resultante y su camino es válido (casillas vecinas y distintas).
  - Con `data/lemario-muestra.txt` y `longitudSembrada: { min: 4, max: 6 }`, `hayPalabraPosible(tablero, lemario, { longitudMinima: 4 })` es `true`.
  - Densidad, con `lemarioSintetico(3000, crearRng(3))` y `radioInicial: 3`: la cobertura de `'suave'`, `'media'` y `'densa'` es al menos objetivo − 0.15 y está ordenada `suave <= media <= densa`. Los umbrales se ajustan contra la semilla fija si hace falta, sin bajar de objetivo − 0.2.
  - `'media'`: cada palabra posterior a la primera comparte al menos una casilla con alguna anterior; `'suave'`: existe al menos un par de palabras que se cruzan.
  - Determinismo: dos llamadas con `crearRng(9)` producen la misma disposición de letras.
  - Caso 1 de la revisión: lemario `[]`, lemario solo de palabras de 3 letras con `longitudSembrada.min: 5`: devuelven tablero completo con letra en cada casilla, sin lanzar.
  - Caso 2 de la revisión: `radioInicial: 0` devuelve 1 casilla con letra; `radioInicial: 1` con `longitudSembrada: { min: 9, max: 9 }` devuelve 7 casillas con letra.
  - `presupuestoIntentos: 1`: tablero completo con letras.
  - Caso 5 de la revisión: `radioInicial: 5` (91 casillas) con `lemarioSintetico(5000, crearRng(5))` termina y devuelve 91 casillas.
- [ ] **Paso 2: ejecutar** `node --test test/siembra.test.js`; esperado: FALLA.
- [ ] **Paso 3: implementar** `src/siembra.js`.
- [ ] **Paso 4: ejecutar** `npm test`; esperado: PASA.
- [ ] **Paso 5: commit** `feat: siembra de palabras en el tablero inicial`.

---

### Tarea 7: Fachada del generador y regeneración en `crecimiento.js`

**Archivos:**
- Crear: `src/generador.js`
- Modificar: `src/crecimiento.js`
- Test: `test/generador.test.js`, `test/crecimiento.test.js` (adaptar y añadir)

**Interfaces:**
- Consume: `sembrarTablero`, `elegirLetras`, `asegurarPalabraLarga` (Tareas 4 a 6), `GENERADOR`.
- Produce:
  - `crearGeneradorLocal(): { sembrarTablero(lemario, config, rng), elegirLetras(tablero, posiciones, lemario, config, rng), asegurarPalabraLarga(tablero, lemario, config, rng, opciones) }` y el singleton `generadorLocal = crearGeneradorLocal()`. Cada método normaliza `config` con `normalizarConfig`.
  - `renovarLetras(tablero, camino, lemario, rng, opciones = {})` y `crecer(tablero, cantidad, modo, lemario, rng, opciones = {})`, con `opciones: { generador = generadorLocal, config = GENERADOR }`. `renovarLetras`: pide a `generador.elegirLetras` las letras de las casillas distintas del camino de una vez; si alguna letra nueva es igual a la anterior, la sustituye con la rutina existente `letraDistinta`; las marcas opcionales se asignan como hasta ahora. `crecer`: decide primero las posiciones (con la lógica actual de `crecerFuera` y `rellenarHuecos`, poniendo la casilla con letra provisional `''`) y después pide las letras de todas las nuevas a `generador.elegirLetras`, y asigna la marca opcional a cada una. Devuelve `{ anadidas, rellenadas }` como hasta ahora.

- [ ] **Paso 1: escribir los tests que fallan.**
  - `crearGeneradorLocal()` tiene los tres métodos; `generadorLocal` es una instancia de la misma forma.
  - `renovarLetras` con un generador de prueba que devuelve `'q'` para todo: las casillas distintas del camino pasan a `'q'` (salvo las que ya eran `'q'`, que reciben otra letra distinta); las casillas fuera del camino no cambian; el generador se llama una sola vez.
  - `crecer` con un generador de prueba: `elegirLetras` se llama una vez con exactamente las posiciones nuevas, y `anadidas`/`rellenadas` valen lo mismo que en los tests actuales de modos `rellenar`, `fuera` y `mixto`.
  - Adaptar los tests existentes de `crecimiento.test.js` que usan un lemario de prueba para que ese lemario implemente `siguientesLetras`, `frecuenciaPar` y `longitudMaxima` (o usar `cargarLemario`), conservando la intención de cada aserción.
- [ ] **Paso 2: ejecutar** `node --test test/generador.test.js test/crecimiento.test.js`; esperado: FALLA.
- [ ] **Paso 3: implementar** `src/generador.js` y los cambios de `crecimiento.js`.
- [ ] **Paso 4: ejecutar** `npm test`; esperado: PASA.
- [ ] **Paso 5: commit** `feat: fachada del generador y regeneración con elegirLetras`.

---

### Tarea 8: Integración en `tablero.js` y `partida.js`

**Archivos:**
- Modificar: `src/tablero.js`, `src/partida.js`, `src/config.js`
- Test: `test/tablero.test.js`, `test/partida.test.js`, `test/ia.test.js` y cualquier otro que dependa de las 7 casillas iniciales

**Interfaces:**
- Consume: `generadorLocal`, `GENERADOR`, `Generador` (forma de la Tarea 7).
- Produce:
  - Se elimina `crearTableroInicial` de `tablero.js` y la constante `RADIO_INICIAL` de `config.js` (y sus imports). Se conservan `garantizarPalabraPosible` y `hayPalabraPosible`.
  - `crearPartida({ modo, tema, lemario, ia, rng, eventoCada, generador = generadorLocal, config = GENERADOR })`. El tablero inicial es `generador.sembrarTablero(lemario, config, rng)`; `reiniciarTablero` hace lo mismo. Se guardan `partida.generador` y `partida.config`. Tras `crecer` (que recibe `{ generador, config }` como `opciones`), en lugar de `garantizarPalabraPosible` se llama a `generador.asegurarPalabraLarga(tablero, lemario, config, rng, { preferir })`, con `preferir` igual a las claves de las casillas distintas del camino jugado.

- [ ] **Paso 1: escribir los tests que fallan.**
  - `crearPartida` con un generador de prueba: `sembrarTablero` se llama una vez con `(lemario, config, rng)` y el tablero es el que devuelve.
  - Tras una jugada aceptada, `asegurarPalabraLarga` se llama con `preferir` que contiene las claves de las casillas del camino y `garantizarPalabraPosible` ya no se llama desde `partida.js`.
  - Misiones: al reiniciar el tablero se vuelve a llamar a `generador.sembrarTablero`.
  - Migrar los tests de `tablero.test.js` que usaban `crearTableroInicial` a `sembrarTablero` con `radioInicial: 1`, y los de `partida.test.js` que dependan de 7 casillas a `config: { ...GENERADOR, radioInicial: 1 }`. Conservar la intención de cada aserción.
  - Con el generador local real, `radioInicial: 3` y `eventoCada: 0` (sin eventos), una partida de supervivencia empieza en `'jugando'` y tras cada jugada aceptada de una secuencia de 5 palabras `hayPalabraPosible(tablero, lemario, { incluirCongeladas: true, longitudMinima: N })` es `true` (con `lemarioSintetico` de `test/helpers.js` y `N = 5`). Sin eventos porque `asegurarPalabraLarga` se llama justo después de crecer, como antes `garantizarPalabraPosible`, y un evento posterior puede eliminar la palabra y provocar derrota, como ya ocurre hoy.
- [ ] **Paso 2: ejecutar** `node --test test/tablero.test.js test/partida.test.js`; esperado: FALLA.
- [ ] **Paso 3: implementar** los cambios.
- [ ] **Paso 4: ejecutar** `npm test`; esperado: PASA, con todos los tests anteriores (migrados) y los nuevos.
- [ ] **Paso 5: commit** `feat: partida usa el generador para sembrar y regenerar`.

---

### Tarea 9: Documentación y verificación en el navegador

**Archivos:**
- Modificar: `README.md`, y `src/main.js` / `src/ui.js` solo si la escala del tablero grande lo exige.

**Interfaces:**
- Consume: todo lo anterior. No produce interfaces nuevas.

- [ ] **Paso 1: documentar en `README.md`** el bloque `GENERADOR` (cada parámetro, su valor inicial y qué hace), la necesidad de un lemario grande para ver tableros enrevesados y cómo cargarlo con un `.txt`.
- [ ] **Paso 2: comprobar la escala.** Con `radioInicial: 3` el SVG debe mostrar las 37 casillas completas, y debe seguir mostrándolas al crecer. Si no, ajustar el cálculo del `viewBox` en `ui.js` o `main.js`.
- [ ] **Paso 3: ejecutar** `npm test`; esperado: todo en verde.
- [ ] **Paso 4: verificación manual**: servir con `python3 -m http.server 8000`, abrir `http://localhost:8000` y comprobar con el lemario de muestra y con uno grande cargado desde un `.txt`:
  - al empezar se ve un tablero de 37 casillas con letras;
  - se encuentran palabras largas, de al menos `longitudGarantizada` letras, formando caminos que se cruzan;
  - tras formar varias palabras, el tablero sigue conteniendo al menos una palabra larga;
  - tras un evento que elimina casillas, las casillas regeneradas encajan palabras;
  - cambiar `densidad` en `config.js` a `'suave'` y a `'densa'` cambia visiblemente la trama.
- [ ] **Paso 5: commit** `docs: README del generador y ajuste de escala`.

---

## Autorevisión

- **Cobertura de la especificación:** configuración (§4, T1); siembra (§5, T6); elección de letras (§6, T4); garantía (§7, T5); interfaz y arquitectura (§8, T2, T3, T7, T8); casos límite (§9, tests de T1, T5, T6); pruebas (§10, todas); manual (T9).
- **Consistencia de tipos:** `Celda`, `Colocacion`, `buscarColocaciones` (T3) los consumen T4, T5 y T6; `elegirLetras`, `asegurarPalabraLarga` y `sembrarTablero` (T4 a T6) son los que expone la fachada de T7 y los que usa T8; `hayPalabraPosible({ longitudMinima })` se define en T5 y se usa en T8.
- **Decisiones que el plan añade a la especificación:** `siguientesLetras` y `longitudMaxima` en lugar de `buscarPatron`; `crearTableroInicial` desaparece para evitar una dependencia circular; `MAX_NODOS_BUSQUEDA` como cota interna por búsqueda; `renovarLetras` conserva la regla actual de que la letra nueva sea distinta de la anterior; el encaje solo sustituye letras de casillas pendientes y no cambia letras fijas; en `'suave'` solo la segunda palabra debe cruzar, en `'media'` todas, en `'densa'` se elige la de más cruces.
