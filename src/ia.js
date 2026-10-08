// IA simulada: valida palabras con el lemario y elige eventos al azar (sin red ni claves).
import { EVENTOS_BASE } from './eventos.js';

export function crearIaSimulada({ lemario, rng }) {
  return {
    async validarPalabra(palabra, _contexto) {
      if (lemario.existe(palabra)) return { valida: true };
      return { valida: false, motivo: 'no-esta-en-el-lemario' };
    },

    async siguienteEvento(estado, _modo, tema) {
      const plantillas = tema && Array.isArray(tema.eventos) && tema.eventos.length > 0
        ? tema.eventos
        : EVENTOS_BASE;
      const plantilla = plantillas[Math.floor(rng() * plantillas.length)];
      const casillas = [...estado.tablero.casillas.values()];
      const elegida = casillas.length > 0
        ? casillas[Math.floor(rng() * casillas.length)]
        : { q: 0, r: 0 };
      return {
        ...plantilla,
        alcance: { ...plantilla.alcance, centro: { q: elegida.q, r: elegida.r } },
      };
    },
  };
}
