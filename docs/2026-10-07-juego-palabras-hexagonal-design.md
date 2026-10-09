# Juego de palabras hexagonal: especificación de diseño

Fecha: 2026-10-07
Estado: pendiente de revisión por Pepe

## 1. Objetivo

Construir un **prototipo web** para probar la mecánica de un juego de palabras sobre un tablero de casillas hexagonales que **crece, pierde casillas y se regenera** según las palabras que forma el jugador. El prototipo debe permitir jugar y ajustar el equilibrio desde el primer día, sin servidor ni claves de API. Si la mecánica resulta divertida, se decidirá después si pasa a móvil o escritorio.

## 2. Alcance

Incluye:
- Tablero hexagonal dinámico (conjunto de casillas, no rejilla fija).
- Formación de palabras por camino libre entre casillas vecinas, pudiendo repetir casilla.
- Crecimiento, eliminación y regeneración de casillas guiados por eventos y mecánicas.
- Dos modos: **supervivencia** (con derrota) y **misiones temáticas**.
- Un módulo de IA con interfaz fija y una implementación simulada (reglas y eventos predefinidos).
- Carga de un lemario desde un archivo `.txt`.

No incluye (fuera de alcance del prototipo):
- Conexión con una IA real, servidor o cuentas de usuario.
- Multijugador, ranking en línea, sonido o animaciones elaboradas.
- App móvil nativa o de escritorio.

## 3. Reglas del juego

### 3.1 Tablero
- Cada casilla tiene una posición hexagonal (coordenadas axiales `q, r`), una letra y, opcionalmente, una marca especial.
- El tablero es el **conjunto de casillas existentes**. Cada casilla tiene hasta 6 vecinas. Crecer o perder casillas es añadir o quitar elementos de ese conjunto.
- **Inicio:** una casilla central y su anillo de 6 vecinas (7 casillas), con letras que garantizan al menos una palabra posible.

### 3.2 Formar una palabra
- El jugador selecciona un **camino** de casillas vecinas. El camino puede girar en cada paso.
- El camino puede **pasar más de una vez por la misma casilla** (cada paso aporta su letra), pero no puede quedarse en la misma casilla dos pasos seguidos.
- Longitud mínima de la palabra: 3 letras.
- Una palabra es válida si la acepta el lemario o, en el futuro, la IA.

### 3.3 Efecto de una palabra válida
- **Renovación:** las letras de las casillas usadas en el camino se actualizan con letras nuevas.
- **Crecimiento:** aparecen casillas nuevas junto al tablero. Cuántas depende de la longitud de la palabra.
- **Modo de crecimiento:** no es una regla fija. Lo decide el evento o la mecánica activa, o una letra especial usada en la palabra:
  - *rellenar huecos*: las casillas nuevas ocupan primero los huecos dejados por eliminaciones;
  - *crecer hacia fuera*: las casillas nuevas se añaden en el borde ignorando los huecos;
  - *mixto*: una parte de cada tipo.
  Si ningún evento ni letra especial impone un modo, se aplica *rellenar huecos*.

### 3.4 Eventos y letras especiales
- Un **evento** es un dato con: tipo (eliminar casillas, congelar casillas, ocultar letras…), alcance (qué casillas afecta), duración y modo de crecimiento que impone mientras está activo.
- Una **letra especial** es una marca en una casilla que, al usarse en una palabra, dispara un evento o cambia el modo de crecimiento solo para esa palabra.
- La eliminación de casillas deja huecos. Las casillas eliminadas pueden regenerarse mediante el crecimiento en modo *rellenar huecos* o *mixto*.

### 3.5 Modos de juego
- **Supervivencia:** partida con final por derrota. Se pierde cuando el tablero se queda sin casillas o cuando no queda ninguna palabra posible en él. Se acumula puntuación.
- **Misiones temáticas:** se avanza cumpliendo objetivos (por ejemplo, formar una palabra de N letras, formar una palabra del tema, regenerar N casillas). Cada **tema** (Halloween, Navidad…) es un paquete de datos con paleta de colores, eventos propios, palabras objetivo y retos.

## 4. Valores iniciales (ajustables en un archivo de configuración)

- Casillas nuevas por palabra válida: 1 por cada 2 letras, mínimo 1.
- Puntuación por palabra: longitud al cuadrado.
- Una misma palabra no puede puntuar dos veces en la misma partida.
- La comparación con el lemario no distingue tildes; la ñ se conserva como letra distinta.
- Las letras nuevas se eligen con frecuencias realistas del español y se comprueba con el lemario que el tablero conserve al menos una palabra posible; si no, se reintenta.

## 5. Interfaz de IA

Un único módulo con dos funciones. El motor del tablero no sabe quién genera los resultados, por lo que la implementación simulada y la IA real son intercambiables.

- `validarPalabra(palabra, contexto)` devuelve `{ valida, motivo }`.
  - Prototipo: consulta el lemario.
- `siguienteEvento(estadoDelTablero, modo, tema)` devuelve un evento en el formato de la sección 3.4.
  - Prototipo: elige de una tabla de eventos predefinidos, con algo de azar y respetando el tema.

## 6. Arquitectura

Una sola página web (HTML y JavaScript, sin servidor). Módulos con una responsabilidad cada uno:

| Módulo | Responsabilidad |
|---|---|
| `hex` | Geometría hexagonal: vecinos, distancias, posición en pantalla. |
| `tablero` | Conjunto de casillas, crecimiento y eliminación. |
| `lemario` | Carga del `.txt` en un trie, validación, detección de palabras posibles, elección de letras por frecuencia. |
| `eventos` | Aplicación de eventos y letras especiales como datos. |
| `ia` | `validarPalabra` y `siguienteEvento` (versión simulada). |
| `modos` | Supervivencia, misiones y paquetes de temas. |
| `ui` | Dibujo del tablero en SVG y entrada del jugador. |

**Interfaz de usuario:** el tablero se dibuja con hexágonos SVG. Se selecciona arrastrando por casillas vecinas o tocándolas una a una (ratón y táctil). Un panel muestra la palabra en construcción, la puntuación, el modo, el evento activo y, en misiones, el objetivo.

**Lemario:** archivo `.txt` con una palabra por línea. Si no se aporta ninguno, el prototipo arranca con una muestra pequeña incluida.

## 7. Pruebas

- Tests automáticos: geometría hexagonal, crecimiento y eliminación del tablero, validación de caminos con casillas repetidas, modos de crecimiento (rellenar, hacia fuera, mixto) y detección de derrota.
- Pruebas manuales en el navegador para el equilibrio y la sensación de juego.

## 8. Decisiones del diseño (resumen de lo acordado)

1. Tablero hexagonal que crece al formar palabras y pierde casillas por eventos, que luego se regeneran.
2. Camino libre con repetición de casilla permitida.
3. Las letras se renuevan al usarse.
4. El modo de crecimiento depende del evento o la mecánica activa.
5. La IA arbitra palabras y crea eventos; en el prototipo está simulada tras una interfaz fija.
6. Dos modos: supervivencia con derrota y misiones temáticas.
7. Primero un prototipo web local (enfoque A).
