// Service worker: guarda el juego para que funcione sin conexión.
// Estrategia: primero la red (así se ven los cambios al momento) y, si falla, la copia guardada.
const CACHE = 'palabras-v2';
const ARCHIVOS = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'iconos/icono-192.png',
  'iconos/icono-512.png',
  'iconos/icono-maskable-512.png',
  'iconos/apple-touch-icon.png',
  'data/lemario.txt',
  'data/tematicas/halloween.txt',
  'data/tematicas/navidad.txt',
  'data/temas/general.json',
  'data/temas/halloween.json',
  'data/temas/navidad.json',
  'src/ajustes.js',
  'src/almacen.js',
  'src/colocacion.js',
  'src/config.js',
  'src/crecimiento.js',
  'src/escaner.js',
  'src/eventos.js',
  'src/garantia.js',
  'src/generador.js',
  'src/hex.js',
  'src/ia.js',
  'src/lemario.js',
  'src/letras.js',
  'src/main.js',
  'src/modos.js',
  'src/partida.js',
  'src/rng.js',
  'src/siembra.js',
  'src/tablero.js',
  'src/ui.js',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (ev) => {
  const { request } = ev;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  ev.respondWith(
    fetch(request)
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE).then((c) => c.put(request, copia));
        }
        return respuesta;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((r) => r ?? Response.error())),
  );
});
