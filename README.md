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
