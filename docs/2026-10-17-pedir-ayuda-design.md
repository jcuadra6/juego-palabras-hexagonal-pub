# Botón «Pedir ayuda»: especificación de diseño

Fecha: 2026-10-17
Estado: pendiente de revisión por Pepe
Amplía `2026-10-13-panel-ayuda-design.md`, que dejó este botón para más adelante. No cambia ninguna regla del juego, la puntuación, los eventos ni el generador.

## 1. Objetivo

Un botón «Pedir ayuda», junto a «Enviar» y «Borrar», que marca en el tablero el camino de una palabra que se puede formar ahora mismo. Reutiliza el escáner (`escanearPalabras`) y la capa de marca (`dibujarMarca`) del panel de ayuda, sin código nuevo de búsqueda.

## 2. Alcance

Incluye:
- El botón y la marca de la pista.
- Pulsar varias veces recorre las palabras posibles en el orden del escáner.

No incluye:
- Penalización de puntuación ni límite de ayudas por partida. Si se quieren, irán en `AYUDA` de `src/config.js`.
- Cambios en el panel de ayuda o en el modo develop.

## 3. Comportamiento

- Al pulsar, se escanea el tablero con las palabras ya jugadas como `excluir` (con el panel encendido o apagado) y se marca la primera palabra de la lista: la de mayor puntuación y, a igualdad, la primera alfabéticamente.
- Si ya hay una pista marcada y sigue en la lista, se pasa a la palabra siguiente; tras la última se vuelve a la primera.
- La marca de la pista se dibuja siempre, esté o no encendido el modo develop, y tiene prioridad sobre la marca de la palabra seleccionada en el panel.
- Si no hay ninguna palabra posible, no se marca nada y se muestra «No hay palabras posibles ahora mismo.».
- La pista se borra tras una jugada aceptada, una partida nueva o un reinicio de tablero. Una jugada rechazada no la borra, porque el tablero no cambia.
- El botón está desactivado sin partida en juego o con una jugada en curso.
- Como la lista del panel, la pista revela el camino de las casillas ocultas por un evento.

## 4. Estructura del código

- Función pura en `src/ui.js`: `siguientePista(palabras, actual: string | null): object | null`. Devuelve la primera palabra si `actual` es `null` o ya no está en la lista, la siguiente a `actual` si está, la primera tras la última, y `null` con la lista vacía.
- `src/main.js`: estado `pista`, el botón y la prioridad de la marca.
- `index.html`: el botón en la sección de la jugada.

## 5. Pruebas

- `siguientePista`: lista vacía, sin pista previa, pista intermedia, última (vuelve a la primera) y pista que ya no está.
- Los tests existentes siguen pasando.
- Verificación manual en el navegador: la pista se marca con el modo develop apagado, pulsar de nuevo pasa a otra palabra y una jugada aceptada la borra.
