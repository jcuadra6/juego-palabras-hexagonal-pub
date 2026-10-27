# Juego de palabras hexagonal

Prototipo en JavaScript (módulos ES, sin dependencias). Diseño: `docs/2026-10-07-juego-palabras-hexagonal-design.md`.

## Jugar

La página carga datos con `fetch`, así que debe servirse por http (no funciona abriendo `index.html` con `file://`):

```
python3 -m http.server 8000
```

y abrir <http://localhost:8000>.

## Instalar en el móvil (PWA)

El juego es una aplicación web instalable: tiene manifiesto (`manifest.webmanifest`), iconos (`iconos/`) y un service worker (`sw.js`) que guarda todo el código y los datos para jugar sin conexión.

- Para instalarlo en el móvil hace falta servirlo por **https** (en el ordenador basta `localhost`). La forma más sencilla es GitHub Pages: en el repositorio, *Settings → Pages → Deploy from a branch*, rama `main`, carpeta `/ (root)`.
- **Android (Chrome):** abre la dirección y pulsa *Instalar aplicación* (o menú ⋮ → *Añadir a pantalla de inicio*).
- **iPhone (Safari):** botón *Compartir* → *Añadir a pantalla de inicio*.
- El service worker pide primero a la red y, si no hay conexión, usa la copia guardada: con conexión siempre se ve la última versión.
- Si añades un archivo nuevo en `src/`, `data/` o `iconos/`, añádelo también a `ARCHIVOS` en `sw.js` (un test lo comprueba). Al cambiar la lista, sube la versión de `CACHE`.

## Tests

```
npm test
```

## Generador de tableros y letras

El tablero inicial y las letras nuevas no se sortean por frecuencia: un generador local (`src/generador.js`, sin servidor ni claves) siembra palabras reales del lemario como caminos de casillas vecinas, elige las letras restantes por combinaciones frecuentes en el lemario y garantiza que, tras regenerar el tablero en cada jugada, haya una palabra larga sin usar (un evento o una marca `eliminar` pueden quitarla después, hasta la jugada siguiente). Diseño: `docs/2026-10-11-generador-tableros-design.md`.

Todo el aleatorio sale de un `rng` inyectado: con la misma semilla, el mismo resultado.

### Configuración (`GENERADOR` en `src/config.js`)

| Parámetro | Valor inicial | Qué hace |
|---|---|---|
| `radioInicial` | `3` | Radio del tablero inicial: 0 = 1 casilla, 1 = 7, 2 = 19, 3 = 37. Entero `>= 0`. |
| `densidad` | `'media'` | Cuánta trama de palabras se siembra: `'suave'`, `'media'` o `'densa'`. En `'suave'` solo la segunda palabra debe cruzar con las anteriores, en `'media'` todas deben cruzar, y en `'densa'` se elige la colocación con más cruces. Un valor desconocido pasa a `'media'`. |
| `densidades` | `{ suave: 0.35, media: 0.60, densa: 0.85 }` | Fracción objetivo de casillas cubiertas por palabras sembradas para cada densidad. |
| `longitudSembrada` | `{ min: 5, max: 9 }` | Rango de longitudes de las palabras sembradas. `min` nunca baja de 3; si `max < min`, `max = min`. |
| `prioridadEncaje` | `0.7` | De 0 a 1. Probabilidad de preferir letras que encajan una palabra posible con las casillas vecinas al renovar, crecer o rellenar casillas. |
| `mezclaPesos` | `0.5` | De 0 a 1. Mezcla del peso por frecuencia de letras en español (0) con el peso por pares de letras del lemario (1) al elegir cada letra. |
| `longitudGarantizada` | `6` | Longitud de la palabra que debe poder formarse en el tablero tras cada regeneración; si no la hay, se repara cambiando letras de casillas no congeladas. Las palabras ya jugadas no cuentan (`opciones.excluir` de `asegurarPalabraLarga`, un `Set` de palabras normalizadas). Nunca baja de 3. |
| `presupuestoIntentos` | `2000` | Máximo de intentos (llamadas a la búsqueda de colocaciones) al sembrar y reparar. Cada búsqueda además se corta a 5000 nodos (`MAX_NODOS_BUSQUEDA`). |

Los valores fuera de rango o de tipo erróneo se normalizan sin error (`normalizarConfig`). Las casillas congeladas nunca se modifican.

### Lemario por defecto

El juego usa por defecto `data/lemario.txt`: 84.519 palabras sacadas del lemario de Teo Ruiz (<https://teoruiz.com/lemario/lemario-20101017.txt.gz>). Solo trae lemas: no hay plurales ni formas verbales («calabaza» vale, «calabazas» no). Se preparó con:

```
node scripts/preparar-lemario.mjs lemario-20101017.txt > data/lemario.txt
```

El script descarta prefijos y sufijos (con guion), locuciones (con espacios) y nombres propios o siglas (empiezan por mayúscula), y normaliza el resto como el juego: minúsculas, sin tildes ni diéresis, con ñ, sin repetidas y en orden alfabético.

`data/lemario-muestra.txt` (unas 465 palabras) ya no lo usa el juego; se queda para los tests.

Para usar otro lemario, cárgalo en **Ajustes → Lemario** (un `.txt` con una palabra por línea; se descartan las líneas no válidas). Sustituye al de por defecto, se empieza una partida nueva, se recuerda en el dispositivo y «Volver al lemario por defecto» lo deshace. Si el lemario no tiene palabras de la longitud pedida, el generador no falla: baja la trama y deja letras por frecuencia.

## Temáticas

En el modo Misiones, el selector **Temática** ofrece «General» (por defecto) y una opción por cada etiqueta de los lemarios de temáticas.

- **Formato:** un `.txt` con una palabra por línea y, tras un `;`, sus etiquetas separadas por comas: `calabaza;halloween,otoño`. Una palabra sin etiquetas es general. Las etiquetas no distinguen mayúsculas ni tildes.
- Las palabras de los lemarios de temáticas se añaden al lemario aunque no estén en él.
- **General:** cualquier palabra válida cuenta para el reto «palabras del tema».
- **Con una etiqueta** (por ejemplo Halloween): se pueden jugar todas las palabras del lemario, pero solo las que llevan esa etiqueta cuentan para el reto de palabras del tema.
- Si la etiqueta coincide con un tema de `data/temas/` (`halloween`, `navidad`), se usan sus colores, eventos y retos. Si no, los de `data/temas/general.json` con el nombre de la etiqueta.
- El juego incluye `data/tematicas/halloween.txt` y `data/tematicas/navidad.txt`. Puedes cargar más en **Ajustes → Temáticas**; se recuerdan en el dispositivo y «Quitar las temáticas que he cargado» las borra (las incluidas se quedan). Un archivo con el mismo nombre sustituye al cargado antes.

## Ajustes

El botón **⚙ Ajustes** abre una pantalla (a pantalla completa en el móvil) con:

- **Lemario:** cuál se usa, cargar uno propio o volver al de por defecto.
- **Temáticas:** las etiquetas disponibles con su número de palabras, cargar lemarios de temáticas y quitar los cargados.
- **Ayuda:** «Mostrar lista de palabras posibles» (el panel de ayuda).
- **Opciones de desarrollador:** el modo develop y los parámetros de `GENERADOR` y `AYUDA` (ver tablas). Se normalizan como en `src/config.js` y se aplican en la próxima partida. «Restaurar valores por defecto» los devuelve a los de `src/config.js`.

Los ajustes, el modo y la temática elegidos se recuerdan en el dispositivo (`localStorage`, `src/ajustes.js`); el lemario propio y las temáticas cargadas, en IndexedDB (`src/almacen.js`). En navegación privada, o si el navegador no deja guardar, todo funciona igual pero no se recuerda.

## Panel de ayuda y modo develop

Una ayuda para probar el generador: lista todas las palabras que se pueden formar ahora mismo en el tablero. Diseño: `docs/2026-10-13-panel-ayuda-design.md`.

### Qué muestra la lista

Con «Mostrar lista de palabras posibles» encendido en Ajustes aparece, a la derecha del tablero (debajo en pantallas estrechas), el encabezado «Palabras posibles (N)» y una lista de botones, uno por palabra del lemario que se puede trazar por casillas vecinas con al menos 3 letras. Cada botón muestra la palabra y su puntuación (`longitud del camino × longitud del camino`). Se excluyen las palabras ya jugadas y las casillas congeladas.

Orden: puntuación descendente y, a igualdad, orden alfabético por comparación de cadenas, sin localización.

La lista se actualiza tras cada jugada, partida nueva o reinicio del tablero. Con el panel apagado no se escanea nada.

La lista revela la letra real de las casillas ocultas por un evento: es una ayuda y se hace a propósito.

Puede quedar incompleta: si se agota el presupuesto de nodos (`maxNodos`) o hay más de `maxPalabras` palabras, se conservan las mejores y se muestra el aviso «La lista puede estar incompleta.».

### Los dos interruptores

Están en la pantalla de ajustes: «Mostrar lista de palabras posibles» (en Ayuda) y «Modo develop» (en Opciones de desarrollador). Empiezan apagados y se recuerdan en el dispositivo.

- **Panel de ayuda:** muestra u oculta el panel. Al apagarlo se borra la lista, la selección y la marca.
- **Modo develop:** con él apagado, la lista es solo texto: pulsar una palabra la marca como seleccionada (`aria-pressed="true"`) pero no dibuja nada en el tablero. Con él encendido, la palabra seleccionada se marca en el tablero con una línea que une las casillas del camino y los números de orden de cada paso (una casilla repetida muestra varios números). Pulsar otra palabra sustituye la marca; pulsar de nuevo la seleccionada la borra. Apagar el modo develop también la borra.

La selección se limpia sola si la palabra deja de estar en la lista (tras jugar, partida nueva o reinicio de tablero).

### Configuración (`AYUDA` en `src/config.js`)

| Parámetro | Valor inicial | Qué hace |
|---|---|---|
| `maxPalabras` | `100` | Máximo de palabras que conserva la lista (las de mayor puntuación). |
| `maxNodos` | `200000` | Máximo de nodos que expande la búsqueda; al agotarse, la lista se marca como incompleta. |

Los valores no numéricos, menores que 1 o no finitos usan los de por defecto, y los decimales se truncan (`normalizarAyuda`).

## Pedir ayuda

El botón «Pedir ayuda», junto a «Enviar» y «Borrar», marca en el tablero el camino de una palabra que se puede formar ahora mismo (línea y números de orden), esté o no encendido el panel o el modo develop. Diseño: `docs/2026-10-17-pedir-ayuda-design.md`.

- La primera pulsación marca la palabra de mayor puntuación de la lista del escáner; cada pulsación siguiente pasa a la siguiente palabra y, tras la última, vuelve a la primera.
- La pista tiene prioridad sobre la marca de la palabra seleccionada en el panel.
- Se borra tras una jugada aceptada, una partida nueva o un reinicio del tablero; una jugada rechazada no la borra.
- Si no hay palabras posibles, muestra «No hay palabras posibles ahora mismo.».
- No penaliza la puntuación ni tiene límite de usos.
