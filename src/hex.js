// Geometría hexagonal con coordenadas axiales (q, r).
const DIRECCIONES = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

export function clave(q, r) {
  return `${q},${r}`;
}

export function vecinos(q, r) {
  return DIRECCIONES.map((d) => ({ q: q + d.q, r: r + d.r }));
}

export function distancia(a, b) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function anillo(radio, centro = { q: 0, r: 0 }) {
  if (radio === 0) return [{ q: centro.q, r: centro.r }];
  const res = [];
  // Empezar en la esquina (-radio direcciones[4]) y recorrer los 6 lados.
  let q = centro.q + DIRECCIONES[4].q * radio;
  let r = centro.r + DIRECCIONES[4].r * radio;
  for (const d of DIRECCIONES) {
    for (let i = 0; i < radio; i++) {
      res.push({ q, r });
      q += d.q;
      r += d.r;
    }
  }
  return res;
}

export function aPixel(q, r, tamano) {
  return {
    x: tamano * Math.sqrt(3) * (q + r / 2),
    y: tamano * 1.5 * r,
  };
}
