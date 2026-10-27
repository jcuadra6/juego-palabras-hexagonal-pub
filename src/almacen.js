// Guarda textos grandes (lemarios propios) en IndexedDB del navegador.
// Si no hay IndexedDB o falla (navegación privada, cuota llena), no guarda y no lanza errores.
const BASE = 'palabras';
const TABLA = 'textos';

function abrir() {
  return new Promise((ok, mal) => {
    const peticion = indexedDB.open(BASE, 1);
    peticion.onupgradeneeded = () => peticion.result.createObjectStore(TABLA);
    peticion.onsuccess = () => ok(peticion.result);
    peticion.onerror = () => mal(peticion.error);
  });
}

async function operar(modo, accion) {
  const bd = await abrir();
  try {
    return await new Promise((ok, mal) => {
      const tx = bd.transaction(TABLA, modo);
      const peticion = accion(tx.objectStore(TABLA));
      tx.oncomplete = () => ok(peticion.result);
      tx.onerror = () => mal(tx.error);
      tx.onabort = () => mal(tx.error);
    });
  } finally {
    bd.close();
  }
}

// Valor guardado con esa clave, o undefined si no hay o falla.
export const leerGuardado = (clave) => operar('readonly', (t) => t.get(clave)).catch(() => undefined);

// Devuelven true si se pudo guardar o borrar.
export const guardar = (clave, valor) => operar('readwrite', (t) => t.put(valor, clave)).then(() => true, () => false);
export const borrarGuardado = (clave) => operar('readwrite', (t) => t.delete(clave)).then(() => true, () => false);
