# Generador de tableros y letras: especificación de diseño

Fecha: 2026-10-11
Estado: pendiente de revisión por Pepe
Amplía y, donde se indica, sustituye a `2026-10-07-juego-palabras-hexagonal-design.md`.

## 1. Objetivo

Hoy las letras del tablero salen solo por frecuencia del español. La única garantía es que exista alguna palabra de 3 letras, así que en partida solo se pueden formar palabras de la longitud mínima y el juego resulta poco entretenido.

Este cambio introduce un **generador** que:

- crea tableros iniciales grandes, con una trama de palabras reales del lemario entrelazadas, incluidas palabras largas;
- al renovar letras, crecer o rellenar huecos, intenta primero encajar palabras del lemario y, si no, elige las letras que más combinaciones habilitan;
- garantiza que en todo momento el tablero conserve al menos una palabra de N letras (N configurable);
- es configurable en tamaño, densidad, longitudes, prioridades y presupuesto.

## 2. Alcance

Incluye:
- El módulo `generador` y su configuración.
- Ampliaciones del lemario necesarias para el generador (listado por longitud, búsqueda por patrón, índice de pares y tríos de letras).
- Cambios en la creación del tablero inicial, en la renovación de letras, en el crecimiento y en el final de cada jugada, para usar el generador.

No incluye:
- Una IA real ni ningún servidor. El generador es local y queda detrás de una interfaz fija, de modo que una IA real podrá sustituirlo más adelante.
- Pantalla de configuración en la interfaz. La configuración vive en `config.js`.
- Cambios en la puntuación, los eventos, las marcas especiales, las casillas congeladas u ocultas, los modos de crecimiento (rellenar, hacia fuera, mixto) ni las reglas de derrota y victoria.

## 3. Qué sustituye de la especificación anterior

- §3.1, "Inicio: una casilla central y su anillo de 6 vecinas (7 casillas)". Ahora el tablero inicial es un disco de radio configurable (`radioInicial`, por defecto 3, es decir 37 casillas).
- §4, "Las letras nuevas se eligen con frecuencias realistas del español y se comprueba con el lemario que el tablero conserve al menos una palabra posible". Ahora las letras las decide el generador según las secciones 5 y 6.

Todo lo demás de la especificación anterior sigue vigente.

## 4. Configuración

Un único bloque `GENERADOR` en `src/config.js`. Valores iniciales, ajustables:

| Parámetro | Valor inicial | Significado |
|---|---|---|
| `radioInicial` | 3 | Radio del tablero inicial (37 casillas). |
| `densidad` | `'media'` | Nivel de trama: `'suave'`, `'media'` o `'densa'`. |
| `densidades` | suave 0.35, media 0.60, densa 0.85 | Fracción del tablero inicial que deben cubrir las palabras sembradas. |
| `longitudSembrada` | `{ min: 5, max: 9 }` | Longitud de las palabras sembradas, recortada a lo que permitan el lemario y el tablero. |
| `prioridadEncaje` | 0.7 | De 0 a 1: probabilidad de intentar encajar una palabra antes de elegir letras por puntuación. |
| `mezclaPesos` | 0.5 | De 0 a 1: peso de las combinaciones con el lemario frente a la frecuencia del español al puntuar una letra. 0 reproduce las frecuencias actuales. |
| `longitudGarantizada` | 6 | N: longitud de la palabra que siempre debe existir en el tablero. |
| `presupuestoIntentos` | 2000 | Máximo de intentos por llamada al generador. Se mide en intentos, no en milisegundos, para que los tests sean deterministas. |

Reglas de validación: `prioridadEncaje` y `mezclaPesos` fuera de `[0, 1]` se recortan al rango; `longitudSembrada.min` y `longitudGarantizada` nunca bajan de `LONGITUD_MINIMA`; una `densidad` desconocida usa `'media'`.

## 5. Siembra del tablero inicial

`sembrarTablero(lemario, config, rng)` devuelve un `Tablero`.

1. Se crea un disco vacío de casillas con el radio `radioInicial`.
2. La cobertura objetivo es `densidades[densidad]` por el número de casillas.
3. Bucle de siembra:
   - se elige una longitud entre `longitudSembrada.min` y `max`, con probabilidad proporcional a la longitud (las largas son más probables);
   - se busca en el lemario una palabra de esa longitud que se pueda colocar como un camino de casillas vecinas, sin repetir casilla dentro de la misma palabra. Una casilla vacía acepta cualquier letra y una ocupada exige que la letra coincida (eso crea el cruce);
   - se prefieren las colocaciones que cruzan con palabras ya colocadas. En `'media'` cada palabra posterior a la primera debe cruzar con alguna anterior. En `'suave'` basta con un cruce en total. En `'densa'` se buscan colocaciones con dos o más cruces y se acepta una con uno si no hay otra;
   - el bucle termina al alcanzar la cobertura o al agotar `presupuestoIntentos`, y entonces se acepta lo conseguido.
4. Las casillas sin cubrir se rellenan con el mismo procedimiento de letras de la sección 6 (pasos 2 a 4).
5. Al final se aplica la garantía de la sección 7.

## 6. Elección de letras

`elegirLetras(tablero, posiciones, lemario, config, rng)` devuelve un `Map` de clave de casilla a letra. Las casillas de `posiciones` se tratan como desconocidas, existan ya en el tablero (renovación) o no (crecimiento y huecos). Las demás casillas ocupadas fijan sus letras.

Se llama al renovar las casillas del camino jugado, al crecer y al rellenar huecos. Dónde crece o se rellena el tablero lo siguen decidiendo los modos de crecimiento existentes.

1. **Encaje.** Con probabilidad `prioridadEncaje`, se busca una palabra del lemario que se coloque como camino por el mayor número posible de casillas de `posiciones`, compatible con las letras fijas vecinas. Se elige la colocación más larga que cubra más casillas y se fijan sus letras. Se puede repetir el intento hasta agotar el presupuesto.
2. **Orden.** Las casillas restantes se rellenan de las más rodeadas de letras fijas a las menos.
3. **Puntuación de cada letra candidata:** `(1 - mezclaPesos) * frecuencia + mezclaPesos * combinaciones`, ambas normalizadas entre las candidatas. `frecuencia` es la frecuencia del español de `FRECUENCIAS_LETRAS`. `combinaciones` es la suma de las frecuencias, en el índice de pares de letras del lemario, de la letra candidata con cada vecina ya fijada, en ambos órdenes. Si no hay vecinas fijadas, `combinaciones` es igual a `frecuencia`.
4. **Sorteo ponderado** por esa puntuación, no el máximo, para que el tablero no sea predecible.
5. Si se agota el presupuesto, las casillas pendientes se rellenan solo por frecuencia, como hoy. El juego nunca se bloquea por el generador.

## 7. Garantía de palabra larga

`asegurarPalabraLarga(tablero, lemario, config, rng, opciones)` devuelve `true` si, al terminar, existe una palabra formable de al menos `longitudGarantizada` letras.

- Se comprueba con `hayPalabraPosible` ampliada con una longitud mínima.
- Si no existe, se siembra una sobre un camino de casillas existentes y no congeladas, eligiendo la palabra y el camino que cambien el mínimo de letras y prefiriendo las casillas recién regeneradas (`opciones.preferir`), para no deshacer otras palabras.
- Si el lemario no tiene palabras de esa longitud, se usa la longitud máxima disponible, nunca por debajo de `LONGITUD_MINIMA`.
- Si no se logra, queda como mínimo la garantía actual: al menos una palabra de la longitud mínima.
- Se llama al terminar el tablero inicial y tras cada jugada aceptada.

## 8. Interfaz y arquitectura

Módulos nuevos:
- `src/generador.js` con las tres funciones anteriores. Si crece demasiado, se divide en `siembra.js` y `letras.js`.

`crearPartida` recibe el generador como parámetro, igual que ya recibe la IA, con el generador local por defecto.

Ampliaciones de `lemario.js` (índices calculados una sola vez al cargar el lemario):
- `palabrasDeLongitud(n): string[]`.
- `siguientesLetras(prefijo): string[]`: letras que pueden continuar un prefijo, para recorrer el árbol de prefijos mientras se busca un camino en el tablero.
- `frecuenciaPar(a, b): number`: veces que la letra `a` va seguida de `b` en las palabras del lemario.
- `longitudMaxima: number`.

Cambios en el resto:
- `tablero.js`: `crearTableroInicial` desaparece, porque `generador.js` ya depende de `tablero.js` y delegar crearía una dependencia circular. `partida.js` llama directamente a `sembrarTablero`. `hayPalabraPosible` admite `{ longitudMinima }`.
- `crecimiento.js`: `renovarLetras` y `crecer` deciden primero las posiciones y piden las letras de golpe a `elegirLetras`.
- `partida.js`: llama a `asegurarPalabraLarga` tras cada jugada aceptada.
- Eventos, marcas, puntuación, congeladas, ocultas y reglas de final: sin cambios.

## 9. Casos límite

- Lemario sin palabras de la longitud pedida: se usa la mayor disponible, nunca por debajo de `LONGITUD_MINIMA`.
- Lemario pequeño (la muestra incluida tiene unas 300 palabras): el generador siembra lo que haya y la cobertura puede quedar por debajo del objetivo. Para tableros realmente enrevesados hace falta un lemario grande, que se puede cargar desde un `.txt`.
- Radio pequeño: la longitud sembrada se recorta a lo que cabe en el tablero.
- Presupuesto agotado: se acepta lo conseguido y se cae a frecuencias, sin lanzar error.
- Casillas congeladas: la siembra y la reparación no las modifican. La comprobación de la garantía de palabra larga las cuenta como disponibles, porque la congelación es temporal, igual que ya hace la regla de derrota.
- Tablero sin casillas libres para rellenar: `elegirLetras` devuelve un `Map` vacío.

## 10. Pruebas

Todas con `rng` fijo y un lemario de prueba:

- Cada palabra sembrada es un camino válido de casillas vecinas y sus letras coinciden en los cruces.
- La cobertura se acerca al objetivo de cada densidad, con tolerancia.
- Cada densidad respeta su regla de cruces.
- Encaje: dado un hueco entre letras conocidas, se coloca la palabra que cabe.
- Modelo mixto: con `mezclaPesos` en 0 reproduce las frecuencias actuales, y con 1 favorece las letras con más combinaciones.
- Garantía: tras gastar la única palabra larga, se repone.
- Lemario sin palabras largas, presupuesto agotado y radio pequeño: no cuelgan el juego ni lanzan error.
- Parámetros fuera de rango se recortan según la sección 4.
- Los 78 tests existentes siguen pasando. Los que dependen de las 7 casillas iniciales fijan `radioInicial: 1` de forma explícita.
- Comprobación manual en el navegador: tablero grande, jugar unos turnos y ver que siguen apareciendo palabras largas.

## 11. Decisiones acordadas

1. Enfoque A: generador local que siembra palabras reales y puntúa letras, detrás de una interfaz fija. Se descartaron solo mejorar los pesos (no garantiza palabras largas) y una IA real (necesita servidor y es lenta y cara).
2. Modelo mixto de letras: frecuencia más combinaciones con el lemario, configurable, con prioridad al encaje de palabras en los huecos.
3. Para incentivar las palabras largas: sembrarlas y regenerar, más garantizar siempre una palabra de N letras. La longitud mínima válida y la puntuación no cambian.
4. Densidad configurable en tres niveles, con media por defecto.
5. Tablero inicial por defecto de radio 3 (37 casillas).
