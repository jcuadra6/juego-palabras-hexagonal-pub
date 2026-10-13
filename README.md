# Juego de palabras hexagonal

Prototipo en JavaScript (módulos ES, sin dependencias). Diseño: `docs/2026-10-07-juego-palabras-hexagonal-design.md`.

## Jugar

La página carga datos con `fetch`, así que debe servirse por http (no funciona abriendo `index.html` con `file://`):

```
python3 -m http.server 8000
```

y abrir <http://localhost:8000>.

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

### Lemario grande

Con el lemario de muestra (`data/lemario-muestra.txt`, unas 465 palabras) el generador funciona, pero hay pocas palabras largas y los cruces son escasos. Para ver tableros realmente enrevesados, con palabras largas que se cruzan, hace falta un lemario grande (decenas de miles de palabras).

Para cargarlo, prepara un `.txt` con una palabra por línea (se normaliza a minúsculas y sin tildes, y se descartan las líneas no válidas) y elígelo en el control «Lemario propio» de la página; se empieza una partida nueva con él. Si el lemario no tiene palabras de la longitud pedida, el generador no falla: baja la trama y deja letras por frecuencia.
