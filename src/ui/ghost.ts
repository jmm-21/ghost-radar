/**
 * Anima la base del fantasma: ondas que avanzan de izquierda a derecha.
 * Los extremos quedan fijos en una punta redondeada (como una tela sujeta por los lados),
 * así nunca se forman picos en los laterales. El SVG del HTML ya trae una forma estática
 * por si JavaScript no se ejecuta o el usuario prefiere menos movimiento.
 */
const LEFT = 12;
const RIGHT = 52;
const MID = 54.25; // altura media de las ondas
const AMP = 2.75; // amplitud (de cresta a valle: 5,5)
const WAVELENGTH = 40 / 3; // 3 ondas a lo ancho
const PERIOD_MS = 1070; // tiempo que tarda una onda en avanzar una longitud
const EDGE = 6; // ancho de la zona de transición en cada extremo
const STEP = 0.5;

const smoothstep = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** Altura del borde inferior en `x` para una fase dada. */
function edgeY(x: number, phase: number): number {
  const wave = Math.sin(((x - LEFT) / WAVELENGTH) * 2 * Math.PI - phase);
  const weight = smoothstep((x - LEFT) / EDGE) * smoothstep((RIGHT - x) / EDGE);
  // En los extremos (weight = 0) el borde queda abajo del todo; en el centro, la onda.
  return MID + AMP * (weight * wave + (1 - weight));
}

export function ghostPath(phase: number): string {
  const f = (n: number) => n.toFixed(2);
  const r = 1.6; // radio de las esquinas inferiores
  const yl = edgeY(LEFT, phase);
  const yr = edgeY(RIGHT, phase);
  let d = `M${f(LEFT + r)} ${f(yl)}Q${LEFT} ${f(yl)} ${LEFT} ${f(yl - r)}V28a20 20 0 0 1 40 0V${f(yr - r)}Q${RIGHT} ${f(yr)} ${f(RIGHT - r)} ${f(yr)}`;
  for (let x = RIGHT - r - STEP; x > LEFT + r; x -= STEP) d += `L${f(x)} ${f(edgeY(x, phase))}`;
  return `${d}Z`;
}

export function animateGhost(): void {
  const body = document.querySelector<SVGPathElement>('#ghost .ghost-body');
  if (!body) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    body.setAttribute('d', ghostPath(0));
    return;
  }
  const frame = (t: number) => {
    // La fase crece con el tiempo → la onda se desplaza hacia la derecha.
    body.setAttribute('d', ghostPath(((t % PERIOD_MS) / PERIOD_MS) * 2 * Math.PI));
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
