# Panel de ayuda y modo develop: especificación de diseño

Fecha: 2026-10-13
Estado: pendiente de revisión por Pepe
Amplía `2026-10-07-juego-palabras-hexagonal-design.md` y `2026-10-11-generador-tableros-design.md`. No cambia ninguna regla de esas especificaciones.

## 1. Objetivo

Dar al jugador, de forma opcional, una ayuda visible: un **panel lateral** con las palabras que se pueden formar ahora mismo en el tablero, ordenadas de mayor a menor puntuación, y un **modo develop** que marca en el tablero el camino de la palabra que se selecciona en esa lista.

La lista sale de una función pura y reutilizable, para que en el futuro un botón "pedir ayuda" pueda tomar una palabra de ella y marcarla en el tablero sin código nuevo de búsqueda.

## 2. Alcance

Incluye:
- Un módulo escáner que calcula las palabras posibles de un tablero.
- Un panel lateral, activable y desactivable, con la lista.
- Un modo develop, activable y desactivable, que dibuja el camino de la palabra seleccionada.
- Configuración de los límites del escáner.

No incluye:
- El botón "pedir ayuda". Queda para más adelante y reutilizará el escáner y la marca.
- Penalizaciones de puntuación por usar la ayuda.
- Recordar entre sesiones el estado de los interruptores.
- Tinte del tablero por intensidad. Se descartó: solo se marca la palabra seleccionada.
- Cambios en las reglas del juego, la puntuación, los eventos o el generador.

## 3. Escáner de palabras posibles

Módulo nuevo `src/escaner.js`, sin nada de interfaz.

`escanearPalabras(tablero, lemario, opciones?)` devuelve `{ palabras, truncado }`.

- `opciones`: `{ excluir?: Set<string>, maxPalabras?: number, maxNodos?: number }`. Los valores por omisión salen del bloque `AYUDA` (sección 7). `excluir` contiene palabras normalizadas, normalmente `partida.palabrasUsadas`.
- Cada elemento de `palabras` es `{ palabra: string, camino: {q, r}[], puntos: number }`.
- **Reglas del juego:** el camino va de casilla en casilla vecina, no se queda en la misma casilla dos pasos seguidos, puede repetir casillas y exige al menos `LONGITUD_MINIMA` letras. Cada paso aporta la letra de su casilla.
- **Casillas:** las congeladas no se usan. Las ocultas se usan con su letra real, porque es una ayuda.
- **Palabras:** se excluyen las de `excluir`. Cada palabra aparece una sola vez. Si se puede formar por varios caminos, se conserva uno, preferentemente el que no repite casillas y, si hay empate, el primero encontrado.
- **Puntuación:** `camino.length * camino.length`, la misma de `jugarPalabra`.
- **Orden:** de mayor a menor puntuación y, a igualdad, alfabético. El resultado es determinista: mismo tablero, misma lista y mismos caminos. Las casillas se recorren ordenadas por `q` y luego `r`, y las vecinas en el orden fijo de `hex.vecinos`.
- **Búsqueda:** recorrido en profundidad guiado por el árbol de prefijos del lemario, que descarta las ramas que no llevan a ninguna palabra y se detiene al llegar a `lemario.longitudMaxima`.
- **Límites:** cada nodo expandido cuenta contra `maxNodos`. Si se agota, la búsqueda se detiene y `truncado` es `true`. Se conservan las `maxPalabras` mejores; si había más, `truncado` también es `true`. La lista puede quedar incompleta cuando `truncado` es `true`.
- Lemario vacío, tablero vacío o sin casillas utilizables devuelven `{ palabras: [], truncado: false }` sin lanzar.
- El escáner no modifica el tablero ni el lemario.

## 4. Interfaz

### 4.1 Distribución
- En pantallas anchas, dos columnas: el juego a la izquierda y el panel de ayuda como lateral a la derecha. En pantallas estrechas, el panel pasa debajo del tablero.
- En la zona de controles, dos casillas independientes: **Panel de ayuda** y **Modo develop**. Ambas están apagadas por defecto y no se recuerdan entre sesiones.

### 4.2 Panel de ayuda
- Encabezado "Palabras posibles (N)", con N el número de palabras de la lista. Si `truncado` es `true`, un aviso dice que la lista puede estar incompleta.
- Lista de como máximo `maxPalabras` palabras, de mayor a menor puntuación, con la palabra en mayúsculas y su puntuación. Tiene desplazamiento propio si es larga.
- Cada palabra es un botón que se puede usar con ratón, dedo o teclado, con `aria-pressed`.
- Pulsar una palabra la selecciona. Pulsar la palabra ya seleccionada la deselecciona. Solo puede haber una seleccionada a la vez, y seleccionar otra reemplaza a la anterior.
- Con el panel apagado, no se escanea nada y el panel no se muestra.

### 4.3 Marca de la palabra seleccionada (modo develop)
- Con el modo develop **encendido** y una palabra seleccionada, se dibuja sobre el tablero su camino: una línea que une las casillas y un número de orden en cada una. Si una casilla se repite en el camino, lleva varios números separados por coma.
- Con el modo develop **apagado**, la lista es solo texto y el tablero no se toca.
- La marca desaparece al deseleccionar la palabra, al apagar el modo develop o al apagar el panel.
- No hay ningún otro marcado del tablero: ni tinte por intensidad ni resaltado de las palabras no seleccionadas.
- La ayuda del futuro marcará su palabra siempre, esté o no encendido el modo develop.

### 4.4 Cuándo se escanea
- Solo con el panel encendido, y una sola vez tras cada jugada aceptada, partida nueva, reinicio de tablero o carga de un lemario propio, es decir, cuando la página ya se redibuja.
- Formar una palabra con el dedo o el ratón no vuelve a escanear.
- Si hay una jugada en curso, el escaneo espera a su resultado.
- Si la palabra seleccionada ya no está en la lista tras un escaneo, se deselecciona y se borra su marca.
- Activar el panel escanea en ese momento. Desactivarlo vacía la lista y la selección.
- La lista usa las palabras ya jugadas de la partida como `excluir`.

### 4.5 Estructura del código
- Funciones puras en `src/ui.js`, sin DOM y probadas con tests:
  - `numerarCamino(camino): Map<string, number[]>`: para cada casilla (clave `"q,r"`), los números de orden, empezando en 1.
  - `alternarSeleccion(seleccionada: string | null, palabra: string): string | null`: devuelve `null` si `palabra` ya estaba seleccionada y `palabra` si no.
- El dibujo de la marca vive en una capa aparte del SVG (un grupo que se borra y se vuelve a crear), igual que el camino que se está formando, para no reconstruir el tablero. Se vuelve a dibujar tras cada redibujado del tablero mientras haya selección.

## 5. Arquitectura y archivos

| Archivo | Cambio |
|---|---|
| `src/escaner.js` | Nuevo: `escanearPalabras`. |
| `src/config.js` | Nuevo bloque `AYUDA`. |
| `src/ui.js` | `numerarCamino`, `alternarSeleccion` y el dibujo de la capa de marca. |
| `src/main.js` | Interruptores, escaneo, lista y selección. |
| `index.html`, `styles.css` | Lateral de dos columnas, lista con desplazamiento y estilos de la marca. |
| `README.md` | Documenta el panel, el modo develop y el bloque `AYUDA`. |
| `test/escaner.test.js`, `test/ui.test.js` | Pruebas nuevas. |

## 6. Casos límite

- Lemario vacío, tablero vacío o de una casilla, o todas las casillas congeladas: lista vacía sin error.
- Más palabras que `maxPalabras`: se conservan las mejores y se avisa con `truncado`.
- Tablero grande con lemario enorme: `maxNodos` acota el trabajo. La lista puede quedar incompleta, y se avisa.
- Palabra seleccionada que deja de ser posible tras una jugada o un evento: se deselecciona y se borra su marca.
- Misiones con reinicio de tablero: se vuelve a escanear y se limpia la selección.
- Jugada en curso mientras se pulsa una palabra de la lista: la selección se aplica a la lista actual y se revisa al terminar el escaneo siguiente.
- Letras ocultas: la lista revela la letra real. Es una decisión deliberada, porque es una ayuda.
- Valores inválidos de `AYUDA` (no numéricos, menores que 1): se usan los valores por defecto.

## 7. Configuración

Bloque `AYUDA` en `src/config.js`:

| Parámetro | Valor inicial | Significado |
|---|---|---|
| `maxPalabras` | 100 | Cuántas palabras se devuelven y se muestran, las de mayor puntuación. |
| `maxNodos` | 200000 | Trabajo máximo del escáner por llamada. |

## 8. Pruebas

- **Escáner:** "ala" en un tablero de dos casillas con su camino `[A,B,A]` y 9 puntos; orden por puntuación descendente y alfabético a igualdad; una palabra aparece una sola vez y se prefiere el camino que no repite casillas; se excluyen las palabras ya jugadas y las casillas congeladas; una casilla oculta cuenta con su letra real.
- **Límites:** con más palabras que `maxPalabras`, se conservan las mejores y `truncado` es `true`; con `maxNodos` bajo, no lanza y devuelve lo reunido con `truncado: true`.
- **Casos límite:** lemario vacío, tablero vacío, una casilla y todo congelado dan lista vacía sin lanzar; mismo tablero, misma lista.
- **Coherencia con el juego:** cada camino devuelto pasa `caminoValido`, y la palabra que forma coincide con la de la lista.
- **Funciones puras:** `numerarCamino` (camino sin repetición y con repetición) y `alternarSeleccion` (selecciona, deselecciona y reemplaza).
- Los 148 tests existentes siguen pasando.
- **Verificación manual en el navegador**, con Chromium sin interfaz: con el panel apagado no hay lista y con él encendido sí; al seleccionar una palabra con el modo develop encendido se dibuja su camino numerado; al deseleccionarla, o al apagar el modo develop, la marca desaparece; tras una jugada se actualiza la lista y se deselecciona una palabra que ya no existe; en pantalla estrecha el panel queda debajo del tablero.

## 9. Decisiones acordadas

1. Escáner puro y local, calculado solo cuando el panel está encendido, y reutilizable por la ayuda del futuro. Se descartaron calcular la lista en cada jugada dentro de la partida y hacerlo en un hilo aparte.
2. Panel lateral de hasta 100 palabras, de mayor a menor puntuación, con su puntuación.
3. Modo develop controla si se dibuja en el tablero el camino de la palabra seleccionada, con numeración de orden. Se descartó el tinte por intensidad.
4. Al desmarcar la palabra en la lista, se borra la marca del tablero.
5. Rama de trabajo `feature/ayuda`, a partir de `feature/generador`.
